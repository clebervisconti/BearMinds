// Avaliação do curso (specs 15.2/15.3): Banco de questões (IA preenche, professor cura) + Provas.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError, type BankQuestion, type BankKind, type AdminExam } from "../../lib/api";

type Tab = "banco" | "provas";
const KIND_LABEL: Record<BankKind, string> = { mcq: "Múltipla escolha", tf: "V/F", short: "Resposta curta", numeric: "Numérica" };

export function AdminAvaliacao() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("banco");
  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav(`/admin/curso/${id}`)} style={{ marginBottom: ".6rem" }}>← Curso</button>
      <div className="bm-page-head"><h1 style={{ fontSize: "1.3rem" }}>Avaliação</h1><div className="sub">Banco de questões e provas — a IA propõe, você aprova.</div></div>
      <div className="bm-tabs">
        <button className={`bm-tab-btn${tab === "banco" ? " active" : ""}`} onClick={() => setTab("banco")}>🗃 Banco de questões</button>
        <button className={`bm-tab-btn${tab === "provas" ? " active" : ""}`} onClick={() => setTab("provas")}>📝 Provas</button>
      </div>
      {id && tab === "banco" && <Banco courseId={id} />}
      {id && tab === "provas" && <Provas courseId={id} />}
      <style>{`
        .bm-tabs{display:flex;gap:.3rem;border-bottom:1px solid var(--bm-border);margin-bottom:1rem;flex-wrap:wrap}
        .bm-tab-btn{padding:.55rem .9rem;border:0;background:none;color:var(--bm-muted);font-weight:600;font-size:.9rem;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
        .bm-tab-btn.active{color:var(--bm-link);border-bottom-color:var(--bm-primary)}
      `}</style>
    </AppShell>
  );
}

// ---------------- Banco ----------------
function Banco({ courseId }: { courseId: string }) {
  const [data, setData] = useState<{ questions: BankQuestion[]; counts: Record<string, number> } | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.bankList(courseId, filter ? { status: filter } : {})); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }, [courseId, filter]);
  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<unknown>) { try { await fn(); await load(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); } }

  if (!data) return <BearLoader label="Carregando banco…" />;
  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="bm-card-flat" style={{ padding: ".7rem 1rem", display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="bm-meta">{data.counts.draft ?? 0} rascunho · {data.counts.approved ?? 0} aprovadas · {data.counts.retired ?? 0} aposentadas</span>
        <select className="bm-input" style={{ width: "auto", marginLeft: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">todas</option><option value="draft">rascunho</option><option value="approved">aprovadas</option><option value="retired">aposentadas</option>
        </select>
        <button className="bm-btn bm-btn-sm" onClick={() => setCreating((v) => !v)}>{creating ? "Fechar" : "+ Questão"}</button>
      </div>
      {creating && <QuestionForm courseId={courseId} onDone={() => { setCreating(false); void load(); }} />}
      {data.questions.length === 0 && <p className="sub">Nenhuma questão. A IA cria rascunhos ao enriquecer um item de lição; você aprova aqui.</p>}
      {data.questions.map((q) => (
        <div key={q.id} className="bm-card" style={{ display: "grid", gap: ".4rem", opacity: q.status === "retired" ? 0.55 : 1 }}>
          <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className="bm-chip bm-chip-outline" style={{ fontSize: ".7rem" }}>{KIND_LABEL[q.kind]}</span>
            {q.origin === "ai" && <span className="bm-chip" style={{ fontSize: ".7rem", color: "var(--bm-link)" }}>✨ IA</span>}
            <span className="bm-chip bm-chip-outline" style={{ fontSize: ".7rem", color: q.status === "approved" ? "var(--bm-success)" : q.status === "retired" ? "var(--bm-muted)" : "var(--bm-warn)" }}>{q.status}</span>
            {q.bncc_code && <span className="bm-meta">{q.bncc_code}</span>}
            <span className="bm-meta">dif. {q.difficulty}{q.version && q.version > 1 ? ` · v${q.version}` : ""}</span>
          </div>
          <div style={{ fontWeight: 550 }}>{q.prompt}</div>
          {q.options && (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: ".88rem" }}>
              {q.options.map((o, i) => <li key={i} style={{ color: i === q.answer ? "var(--bm-success)" : "var(--bm-muted)", fontWeight: i === q.answer ? 600 : 400 }}>{o}{i === q.answer ? " ✓" : ""}</li>)}
            </ul>
          )}
          {q.status !== "retired" && (
            <div style={{ display: "flex", gap: ".4rem" }}>
              {!q.approved && <button className="bm-btn bm-btn-sm" onClick={() => act(() => api.bankApprove(q.id))}>✓ Aprovar</button>}
              <button className="bm-btn-quiet bm-btn-sm" onClick={() => { if (confirm("Aposentar esta questão?")) void act(() => api.bankDelete(q.id)); }}>Aposentar</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QuestionForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [kind, setKind] = useState<BankKind>("mcq");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [answerIdx, setAnswerIdx] = useState(0);
  const [tfAnswer, setTfAnswer] = useState(true);
  const [numAnswer, setNumAnswer] = useState("");
  const [shortAnswer, setShortAnswer] = useState("");
  const [bncc, setBncc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr(null);
    try {
      let answer: unknown, opts: string[] | null = null;
      if (kind === "mcq") { opts = options.map((o) => o.trim()).filter(Boolean); answer = answerIdx; if (opts.length < 2) throw new Error("Mín. 2 opções."); }
      else if (kind === "tf") answer = tfAnswer;
      else if (kind === "numeric") answer = { value: Number(numAnswer), tolerance: 0 };
      else answer = { accepted: shortAnswer.split(";").map((s) => s.trim()).filter(Boolean) };
      await api.bankCreate(courseId, { kind, prompt: prompt.trim(), options: opts, answer, bncc_code: bncc.trim() || null });
      onDone();
    } catch (e) { setErr(e instanceof ApiError ? e.message : (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="bm-card" style={{ display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
        {(["mcq", "tf", "numeric", "short"] as BankKind[]).map((k) => (
          <button key={k} className={`bm-btn-sm ${kind === k ? "bm-btn" : "bm-btn bm-btn-ghost"}`} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <textarea className="bm-input" rows={2} placeholder="Enunciado da questão" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      {kind === "mcq" && options.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <input type="radio" name="correct" checked={answerIdx === i} onChange={() => setAnswerIdx(i)} title="correta" />
          <input className="bm-input" placeholder={`Opção ${i + 1}`} value={o} onChange={(e) => setOptions(options.map((x, j) => j === i ? e.target.value : x))} />
        </div>
      ))}
      {kind === "mcq" && options.length < 6 && <button className="bm-btn-quiet bm-btn-sm" style={{ justifySelf: "start" }} onClick={() => setOptions([...options, ""])}>+ opção</button>}
      {kind === "tf" && <label className="bm-meta">Resposta: <select className="bm-input" style={{ width: "auto" }} value={String(tfAnswer)} onChange={(e) => setTfAnswer(e.target.value === "true")}><option value="true">Verdadeiro</option><option value="false">Falso</option></select></label>}
      {kind === "numeric" && <input className="bm-input" type="number" placeholder="Resposta numérica" value={numAnswer} onChange={(e) => setNumAnswer(e.target.value)} />}
      {kind === "short" && <input className="bm-input" placeholder="Respostas aceitas (separe por ;)" value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} />}
      <input className="bm-input" placeholder="Código BNCC (opcional, p/ pools de prova)" value={bncc} onChange={(e) => setBncc(e.target.value)} />
      {err && <ErrorNote>{err}</ErrorNote>}
      <button className="bm-btn bm-btn-sm" disabled={busy || prompt.trim().length < 3} onClick={save} style={{ justifySelf: "start" }}>{busy ? "Salvando…" : "Criar rascunho"}</button>
    </div>
  );
}

// ---------------- Provas ----------------
function Provas({ courseId }: { courseId: string }) {
  const [exams, setExams] = useState<AdminExam[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setExams((await api.examList(courseId)).exams); } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }, [courseId]);
  useEffect(() => { void load(); }, [load]);
  async function act(fn: () => Promise<unknown>) { try { await fn(); await load(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); } }

  if (!exams) return <BearLoader label="Carregando provas…" />;
  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      {err && <ErrorNote>{err}</ErrorNote>}
      <button className="bm-btn bm-btn-sm" style={{ justifySelf: "start" }} onClick={() => setCreating((v) => !v)}>{creating ? "Fechar" : "+ Nova prova"}</button>
      {creating && <ExamForm courseId={courseId} onDone={() => { setCreating(false); void load(); }} />}
      {exams.length === 0 && <p className="sub">Nenhuma prova. Crie um pool de questões aprovadas por BNCC e a prova sorteia por aluno.</p>}
      {exams.map((e) => (
        <div key={e.id} className="bm-card" style={{ display: "grid", gap: ".4rem" }}>
          <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 650 }}>{e.title}</span>
            <span className="bm-chip bm-chip-outline" style={{ fontSize: ".7rem", color: e.status === "published" ? "var(--bm-success)" : "var(--bm-muted)" }}>{e.status}</span>
          </div>
          <div className="bm-meta">{e.pool.n} questões · pool aprovado: {e.pool_available} · {e.duration_min ? `${e.duration_min} min` : "sem tempo"} · {e.students_attempted} aluno(s) fizeram</div>
          {e.pool_available < e.pool.n && <div className="bm-meta" style={{ color: "var(--bm-warn)" }}>⚠ pool insuficiente — aprove mais questões no banco</div>}
          <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
            {e.status !== "published" ? <button className="bm-btn bm-btn-sm" disabled={e.pool_available < e.pool.n} onClick={() => act(() => api.examSetStatus(e.id, "published"))}>Publicar</button>
              : <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => act(() => api.examSetStatus(e.id, "closed"))}>Encerrar</button>}
            <button className="bm-btn-quiet bm-btn-sm" onClick={() => setResults(results === e.id ? null : e.id)}>{results === e.id ? "Fechar" : "📊 Resultados"}</button>
          </div>
          {results === e.id && <ExamResults examId={e.id} />}
        </div>
      ))}
    </div>
  );
}

function ExamForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [bncc, setBncc] = useState("");
  const [n, setN] = useState(5);
  const [duration, setDuration] = useState(20);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr(null);
    try {
      const codes = bncc.split(",").map((s) => s.trim()).filter(Boolean);
      await api.examCreate(courseId, { title: title.trim(), pool: { bncc_codes: codes.length ? codes : null, n }, duration_min: duration });
      onDone();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); } finally { setBusy(false); }
  }
  return (
    <div className="bm-card" style={{ display: "grid", gap: ".5rem" }}>
      <input className="bm-input" placeholder="Título da prova" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="bm-input" placeholder="Códigos BNCC do pool (vírgula; vazio = todo o banco aprovado)" value={bncc} onChange={(e) => setBncc(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem" }}>
        <label className="bm-meta">Nº de questões<input className="bm-input" type="number" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        <label className="bm-meta">Duração (min)<input className="bm-input" type="number" min={1} max={300} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <button className="bm-btn bm-btn-sm" disabled={busy || title.trim().length < 2} onClick={save} style={{ justifySelf: "start" }}>{busy ? "Criando…" : "Criar prova"}</button>
    </div>
  );
}

function ExamResults({ examId }: { examId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.examResults>> | null>(null);
  useEffect(() => { api.examResults(examId).then(setData).catch(() => setData(null)); }, [examId]);
  if (!data) return <BearLoader label="Carregando resultados…" />;
  return (
    <div style={{ borderTop: "1px solid var(--bm-border)", paddingTop: ".6rem", display: "grid", gap: ".6rem" }}>
      <div className="bm-eyebrow">Notas ({data.attempts.length})</div>
      {data.attempts.length === 0 && <p className="bm-meta">Ninguém enviou ainda.</p>}
      {data.attempts.map((a, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem" }}><span>{a.display_name}</span><strong>{Math.round(a.score * 100)}%</strong></div>
      ))}
      {data.per_question.length > 0 && (
        <>
          <div className="bm-eyebrow" style={{ marginTop: ".3rem" }}>Acerto por questão (menor primeiro = revisar)</div>
          {data.per_question.map((q) => (
            <div key={q.qid} style={{ fontSize: ".85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{q.prompt}</span><strong style={{ color: q.pct < 50 ? "var(--bm-danger)" : "var(--bm-ink)" }}>{q.pct}%</strong></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
