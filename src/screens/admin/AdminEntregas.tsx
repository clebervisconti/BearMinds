// Correção de tarefas (spec 15.4): fila de submissões, pré-análise IA (sugestão), rubrica + feedback → devolver.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError, type AdminSubmission, type Rubric, type AiAssist } from "../../lib/api";

export function AdminEntregas() {
  const { itemId, courseId } = useParams();
  const nav = useNavigate();
  const [subs, setSubs] = useState<AdminSubmission[] | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      const s = await api.submissionsForItem(itemId);
      setSubs(s.submissions);
      if (courseId) setRubrics((await api.rubricList(courseId)).rubrics);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }, [itemId, courseId]);
  useEffect(() => { void load(); }, [load]);

  if (!subs) return <AppShell><BearLoader label="Carregando entregas…" /></AppShell>;
  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav(`/admin/curso/${courseId}`)} style={{ marginBottom: ".6rem" }}>← Curso</button>
      <div className="bm-page-head"><h1 style={{ fontSize: "1.3rem" }}>Entregas da tarefa</h1><div className="sub">{subs.length} submissão(ões). Corrija com rubrica e feedback.</div></div>
      {err && <ErrorNote>{err}</ErrorNote>}
      {subs.length === 0 && <p className="sub">Nenhuma entrega ainda.</p>}
      <div style={{ display: "grid", gap: ".6rem" }}>
        {subs.map((s) => (
          <div key={s.id} className="bm-card" style={{ display: "grid", gap: ".4rem" }}>
            <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 620 }}>{s.student}</span>
              <span className="bm-chip bm-chip-outline" style={{ fontSize: ".7rem", color: s.status === "returned" ? "var(--bm-success)" : "var(--bm-warn)" }}>{s.status}</span>
              {s.points !== null && <span className="bm-chip" style={{ fontSize: ".72rem" }}>{s.points} pts</span>}
              <button className="bm-btn-quiet bm-btn-sm" style={{ marginLeft: "auto" }} onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Fechar" : "Corrigir"}</button>
            </div>
            {open === s.id && <ReviewPanel sub={s} rubrics={rubrics} onDone={() => { setOpen(null); void load(); }} />}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function ReviewPanel({ sub, rubrics, onDone }: { sub: AdminSubmission; rubrics: Rubric[]; onDone: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [rubricId, setRubricId] = useState<string>("");
  const [selections, setSelections] = useState<number[][]>([]);
  const [points, setPoints] = useState("");
  const [ai, setAi] = useState<AiAssist | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rubric = rubrics.find((r) => r.id === rubricId);

  async function runAi() {
    setAiBusy(true); setErr(null);
    try { setAi((await api.aiReviewSubmission(sub.id)).ai_assist); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "IA indisponível."); } finally { setAiBusy(false); }
  }
  async function save() {
    setBusy(true); setErr(null);
    try {
      await api.reviewSubmission(sub.id, {
        feedback: feedback.trim(),
        rubric_id: rubric ? rubricId : null,
        selections: rubric ? selections : null,
        points: rubric ? null : (points ? Number(points) : null),
      });
      onDone();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao salvar."); } finally { setBusy(false); }
  }

  return (
    <div style={{ borderTop: "1px solid var(--bm-border)", paddingTop: ".6rem", display: "grid", gap: ".6rem" }}>
      <div className="bm-card-flat" style={{ padding: ".7rem .9rem", whiteSpace: "pre-wrap", fontSize: ".9rem", maxHeight: 220, overflow: "auto" }}>
        {sub.body_text || <em className="bm-meta">Sem texto{sub.file_id ? " — ver arquivo anexo." : "."}</em>}
      </div>
      {sub.file_id && <a className="bm-btn bm-btn-ghost bm-btn-sm" href={`/api/files/${sub.file_id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", justifySelf: "start" }}>📎 Abrir anexo</a>}

      {/* Pré-análise IA (sugestão, nunca nota) */}
      <div>
        <button className="bm-btn bm-btn-ghost bm-btn-sm" disabled={aiBusy || !sub.body_text} onClick={runAi}>{aiBusy ? "Analisando…" : "✨ Pré-análise da IA"}</button>
        {ai && (
          <div className="bm-card-flat" style={{ padding: ".7rem .9rem", marginTop: ".5rem", display: "grid", gap: ".3rem", fontSize: ".85rem", background: "color-mix(in srgb,var(--bm-primary) 6%,transparent)" }}>
            <div><b>Resumo:</b> {ai.summary}</div>
            {ai.coverage?.length > 0 && <div><b>Cobre:</b> {ai.coverage.join(", ")}</div>}
            {ai.gaps?.length > 0 && <div><b>Lacunas:</b> {ai.gaps.join(", ")}</div>}
            <div><b>Suspeita de IA:</b> <span style={{ color: ai.ai_suspicion === "alta" ? "var(--bm-danger)" : ai.ai_suspicion === "média" ? "var(--bm-warn)" : "var(--bm-success)" }}>{ai.ai_suspicion}</span></div>
            <div className="bm-meta">Sugestão da IA — a nota e a decisão são suas.</div>
          </div>
        )}
      </div>

      {/* Rubrica ou nota simples */}
      {rubrics.length > 0 && (
        <label className="bm-meta">Rubrica: <select className="bm-input" style={{ width: "auto" }} value={rubricId} onChange={(e) => { setRubricId(e.target.value); setSelections([]); }}>
          <option value="">— nota simples —</option>{rubrics.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select></label>
      )}
      {rubric ? rubric.sections.map((sec, si) => (
        <div key={si} className="bm-card-flat" style={{ padding: ".6rem .8rem" }}>
          <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{sec.title} <span className="bm-meta">(peso {sec.weight})</span></div>
          {sec.criteria.map((cri, ci) => (
            <div key={ci} style={{ marginTop: ".3rem" }}>
              <div className="bm-meta">{cri.label}</div>
              <div style={{ display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
                {cri.levels.map((lv, li) => (
                  <button key={li} className={`bm-btn-sm ${selections[si]?.[ci] === li ? "bm-btn" : "bm-btn bm-btn-ghost"}`}
                    onClick={() => setSelections((prev) => { const n = prev.map((r) => [...r]); (n[si] ??= [])[ci] = li; return n; })}>{lv.label} ({lv.points})</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )) : (
        <input className="bm-input" type="number" placeholder="Nota (opcional)" value={points} onChange={(e) => setPoints(e.target.value)} />
      )}
      <textarea className="bm-input" rows={3} placeholder="Feedback para o aluno (obrigatório)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      {err && <ErrorNote>{err}</ErrorNote>}
      <button className="bm-btn bm-btn-sm" disabled={busy || feedback.trim().length < 1} onClick={save} style={{ justifySelf: "start" }}>{busy ? "Devolvendo…" : "Devolver ao aluno"}</button>
    </div>
  );
}
