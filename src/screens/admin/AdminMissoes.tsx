// Correção de missões (spec 17.5): fila de gravações, pré-análise IA sobre a transcrição digitada
// (sem ASR automático), rubrica + feedback → devolver.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError, type AdminMissionSubmission, type Rubric, type MissionAiPreanalysis } from "../../lib/api";

export function AdminMissoes() {
  const { itemId, courseId } = useParams();
  const nav = useNavigate();
  const [subs, setSubs] = useState<AdminMissionSubmission[] | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      const s = await api.missionSubmissionsForItem(itemId);
      setSubs(s.submissions);
      if (courseId) setRubrics((await api.rubricList(courseId)).rubrics);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }, [itemId, courseId]);
  useEffect(() => { void load(); }, [load]);

  if (!subs) return <AppShell><BearLoader label="Carregando missões…" /></AppShell>;
  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav(`/admin/curso/${courseId}`)} style={{ marginBottom: ".6rem" }}>← Curso</button>
      <div className="bm-page-head"><h1 style={{ fontSize: "1.3rem" }}>Missões enviadas</h1><div className="sub">{subs.length} gravação(ões). Ouça/assista e avalie por rubrica.</div></div>
      {err && <ErrorNote>{err}</ErrorNote>}
      {subs.length === 0 && <p className="sub">Nenhuma missão enviada ainda.</p>}
      <div style={{ display: "grid", gap: ".6rem" }}>
        {subs.map((s) => (
          <div key={s.id} className="bm-card" style={{ display: "grid", gap: ".4rem" }}>
            <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 620 }}>{s.student}</span>
              <span className="bm-chip bm-chip-outline" style={{ fontSize: ".7rem", color: s.status === "reviewed" ? "var(--bm-success)" : "var(--bm-warn)" }}>{s.status}</span>
              {s.points !== null && <span className="bm-chip" style={{ fontSize: ".72rem" }}>{s.points} pts</span>}
              <span className="bm-meta">retido até {new Date(s.retention_until).toLocaleDateString("pt-BR")}</span>
              <button className="bm-btn-quiet bm-btn-sm" style={{ marginLeft: "auto" }} onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Fechar" : "Corrigir"}</button>
            </div>
            {open === s.id && <MissionReviewPanel sub={s} rubrics={rubrics} onDone={() => { setOpen(null); void load(); }} />}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function MissionReviewPanel({ sub, rubrics, onDone }: { sub: AdminMissionSubmission; rubrics: Rubric[]; onDone: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [rubricId, setRubricId] = useState<string>("");
  const [selections, setSelections] = useState<number[][]>([]);
  const [points, setPoints] = useState("");
  const [ai, setAi] = useState<MissionAiPreanalysis | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rubric = rubrics.find((r) => r.id === rubricId);

  async function runAi() {
    setAiBusy(true); setErr(null);
    try { setAi((await api.missionAiPreanalysis(sub.id)).ai_preanalysis); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "IA indisponível."); } finally { setAiBusy(false); }
  }
  async function save() {
    setBusy(true); setErr(null);
    try {
      await api.reviewMission(sub.id, {
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
      {/* <video> também toca arquivos de áudio (barra de controles simples, sem quadro de vídeo) */}
      <video controls preload="metadata" src={`/api/files/${sub.file_id}`} style={{ width: "100%", maxHeight: 360, borderRadius: 10, background: "#000" }} />
      <div className="bm-card-flat" style={{ padding: ".7rem .9rem", whiteSpace: "pre-wrap", fontSize: ".9rem", maxHeight: 180, overflow: "auto" }}>
        {sub.transcript || <em className="bm-meta">Sem transcrição digitada pelo aluno.</em>}
      </div>

      <div>
        <button className="bm-btn bm-btn-ghost bm-btn-sm" disabled={aiBusy || !sub.transcript} onClick={runAi}>{aiBusy ? "Analisando…" : "✨ Pré-análise da IA"}</button>
        {ai && (
          <div className="bm-card-flat" style={{ padding: ".7rem .9rem", marginTop: ".5rem", display: "grid", gap: ".3rem", fontSize: ".85rem", background: "color-mix(in srgb,var(--bm-primary) 6%,transparent)" }}>
            <div><b>Resumo:</b> {ai.summary}</div>
            {ai.coverage?.length > 0 && <div><b>Cobre:</b> {ai.coverage.join(", ")}</div>}
            {ai.gaps?.length > 0 && <div><b>Lacunas:</b> {ai.gaps.join(", ")}</div>}
            {ai.keywords_found?.length > 0 && <div><b>Palavras-chave:</b> {ai.keywords_found.join(", ")}</div>}
            <div className="bm-meta">Sugestão da IA — a nota e a decisão são suas.</div>
          </div>
        )}
      </div>

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
