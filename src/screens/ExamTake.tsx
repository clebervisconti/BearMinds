// Prova — lado do estudante (spec 15.3): inicia, responde cronometrado, envia, vê nota.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote } from "../components/common";
import { api, ApiError, type ExamQuestion } from "../lib/api";
import { useMe, activeChild } from "../lib/queries";

export function ExamTake() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;

  const [attempt, setAttempt] = useState<{ attempt_id: string; duration_min: number | null; questions: ExamQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<{ score: number; needs_manual: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submitted = useRef(false);

  useEffect(() => {
    if (!child || !id) return;
    api.examStart(id, child.id)
      .then((a) => { setAttempt(a); if (a.duration_min) setDeadline(Date.now() + a.duration_min * 60000); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Não foi possível iniciar a prova."));
  }, [id, child?.id]);

  const submit = useCallback(async () => {
    if (!child || !id || !attempt || submitted.current) return;
    submitted.current = true;
    try {
      const payload = attempt.questions.map((q) => ({ qid: q.id, response: answers[q.id] ?? null }));
      const r = await api.examSubmit(id, attempt.attempt_id, child.id, payload);
      setResult({ score: r.score, needs_manual: r.needs_manual });
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao enviar."); submitted.current = false; }
  }, [child?.id, id, attempt, answers]);

  // cronômetro + auto-submit ao esgotar
  useEffect(() => {
    if (!deadline || result) return;
    const t = setInterval(() => {
      const n = Date.now(); setNow(n);
      if (n >= deadline) { clearInterval(t); void submit(); }
    }, 500);
    return () => clearInterval(t);
  }, [deadline, result, submit]);

  if (me.isLoading || (!attempt && !err)) return <AppShell><BearLoader label="Preparando sua prova…" /></AppShell>;
  if (err) return <AppShell><ErrorNote>{err}</ErrorNote><button className="bm-btn bm-btn-ghost bm-btn-sm" style={{ marginTop: ".8rem" }} onClick={() => nav(-1)}>← Voltar</button></AppShell>;

  if (result) {
    return (
      <AppShell>
        <div style={{ maxWidth: 440, margin: "2rem auto", textAlign: "center", display: "grid", gap: ".8rem", justifyItems: "center" }}>
          <div style={{ fontSize: "3rem" }} aria-hidden>{result.score >= 0.6 ? "🎉" : "💪"}</div>
          <h1>Prova enviada!</h1>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: result.score >= 0.6 ? "var(--bm-success)" : "var(--bm-warn)" }}>{Math.round(result.score * 100)}%</div>
          <p className="sub">{result.needs_manual > 0 ? `${result.needs_manual} questão(ões) aberta(s) serão corrigidas pelo professor.` : "Correção automática concluída."}</p>
          <button className="bm-btn" onClick={() => nav(params.get("curso") ? `/curso/${params.get("curso")}` : "/")}>Voltar ao curso</button>
        </div>
      </AppShell>
    );
  }

  const remaining = deadline ? Math.max(0, deadline - now) : null;
  const answeredCount = attempt!.questions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", position: "sticky", top: 60, background: "var(--bm-surface)", padding: ".5rem 0", zIndex: 5 }}>
        <span className="bm-eyebrow">{answeredCount}/{attempt!.questions.length} respondidas</span>
        {remaining !== null && <span className="bm-chip" style={{ color: remaining < 60000 ? "var(--bm-danger)" : "var(--bm-ink)", fontWeight: 700 }}>⏱ {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}</span>}
      </div>
      <div style={{ display: "grid", gap: "1rem" }}>
        {attempt!.questions.map((q, qi) => (
          <div key={q.id} className="bm-card" style={{ display: "grid", gap: ".6rem" }}>
            <div style={{ fontWeight: 600 }}><span className="bm-eyebrow">Q{qi + 1}</span> · {q.prompt}</div>
            {q.kind === "mcq" && q.options && q.options.map((opt, i) => (
              <label key={i} className="bm-opt-row" style={{ background: answers[q.id] === i ? "color-mix(in srgb,var(--bm-primary) 10%,transparent)" : "var(--bm-surface-2)" }}>
                <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers({ ...answers, [q.id]: i })} /> {opt}
              </label>
            ))}
            {q.kind === "tf" && ["Verdadeiro", "Falso"].map((lbl, i) => (
              <label key={i} className="bm-opt-row" style={{ background: answers[q.id] === (i === 0) ? "color-mix(in srgb,var(--bm-primary) 10%,transparent)" : "var(--bm-surface-2)" }}>
                <input type="radio" name={q.id} checked={answers[q.id] === (i === 0)} onChange={() => setAnswers({ ...answers, [q.id]: i === 0 })} /> {lbl}
              </label>
            ))}
            {q.kind === "numeric" && <input className="bm-input" type="number" placeholder="Sua resposta" onChange={(e) => setAnswers({ ...answers, [q.id]: Number(e.target.value) })} />}
            {q.kind === "short" && <input className="bm-input" placeholder="Sua resposta" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />}
          </div>
        ))}
      </div>
      <button className="bm-btn" style={{ marginTop: "1.2rem", width: "100%", padding: ".9rem" }} onClick={() => { if (confirm("Enviar a prova? Não dá para refazer as respostas depois.")) void submit(); }}>Enviar prova</button>
      <style>{`.bm-opt-row{display:flex;align-items:center;gap:.6rem;padding:.6rem .8rem;border-radius:10px;cursor:pointer;font-size:.92rem}`}</style>
    </AppShell>
  );
}
