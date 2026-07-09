// Página do curso (spec 13.4) — módulos como missões, Learning Backlog visível (Inteli),
// player de itens (vídeo/documento inline; lição/quiz → LearningExperience) e conclusão mastery-gated.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote, Progress } from "../components/common";
import {
  api, ApiError, type LearnCourse, type LearnItem, type ChecklistStep, type MissionSubmission, type Exemplar,
} from "../lib/api";
import { useMe, activeChild } from "../lib/queries";

const KIND_ICON: Record<string, string> = {
  video: "🎬", document: "📄", lesson: "📖", quiz: "✍️", game: "🎮", live: "📡", quick_update: "⚡", mission: "🎙️",
};

function embedUrl(url: string): string | null {
  let m = /youtube\.com\/watch\?v=([\w-]+)/.exec(url) || /youtu\.be\/([\w-]+)/.exec(url) || /youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/.exec(url);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

export function CursoPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const [data, setData] = useState<LearnCourse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !child) return;
    try {
      setData(await api.learnCourse(id, child.id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao carregar curso.");
    }
  }, [id, child?.id]);

  useEffect(() => { void load(); }, [load]);

  if (me.isLoading || (!data && !err)) return <AppShell><BearLoader label="Carregando curso…" /></AppShell>;
  if (!child) return null;

  async function enroll() {
    if (!id || !child) return;
    try {
      await api.learnEnroll(child.id, id);
      void load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao inscrever.");
    }
  }

  async function markDone(item: LearnItem) {
    if (!child) return;
    const r = await api.learnItemProgress(item.id, child.id, "done");
    if (r.module_completed) {
      alert("🎉 Módulo concluído com maestria! +100 moedas");
    }
    void load();
  }

  const totalItems = data?.modules.reduce((a, m) => a + m.items.length, 0) ?? 0;
  const doneItems = data?.modules.reduce((a, m) => a + m.items.filter((i) => i.progress.status === "done").length, 0) ?? 0;

  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav("/cursos")} style={{ marginBottom: ".6rem" }}>← Cursos</button>
      {err && <ErrorNote>{err}</ErrorNote>}
      {data && (
        <>
          <div className="bm-page-head" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "2.4rem" }}>{data.course.cover_emoji}</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{ fontSize: "1.3rem" }}>{data.course.title}</h1>
              {data.course.description && <div className="sub">{data.course.description}</div>}
              {data.enrolled && totalItems > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginTop: ".5rem", maxWidth: 360 }}>
                  <div style={{ flex: 1 }}><Progress value={doneItems / totalItems} /></div>
                  <span className="bm-meta">{doneItems}/{totalItems}</span>
                </div>
              )}
            </div>
            {!data.enrolled && <button className="bm-btn" onClick={enroll}>Inscrever-se</button>}
            {data.enrolled && (
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav(`/curso/${id}/interagir`, { state: { title: data.course.title } })}>💬 Interação</button>
            )}
            {data.completed_at && <span className="bm-chip" style={{ background: "color-mix(in srgb, var(--bm-success) 14%, transparent)", color: "var(--bm-success)", fontWeight: 700 }}>✓ Curso concluído</span>}
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            {data.modules.map((m, mi) => (
              <section key={m.id} className="bm-card" style={{ display: "grid", gap: ".7rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: ".5rem" }}>
                  <div>
                    <div className="bm-eyebrow">Missão {mi + 1}</div>
                    <div style={{ fontWeight: 680, fontSize: "1.05rem" }}>{m.title}</div>
                    {m.objectives && <div className="bm-meta">{m.objectives}</div>}
                  </div>
                  {m.locked && <span className="bm-chip bm-chip-outline" style={{ color: "var(--bm-muted)" }}>🔒 {m.lock_reason ?? "bloqueada"}</span>}
                  {m.complete && <span className="bm-chip" style={{ color: "var(--bm-success)", fontWeight: 700 }}>✓ dominada</span>}
                </div>

                {/* itens */}
                <div style={{ display: "grid", gap: ".5rem", opacity: m.locked ? 0.55 : 1 }}>
                  {m.items.map((item) => (
                    item.kind === "assignment" ? (
                      <AssignmentCard key={item.id} item={item} childId={child.id} enrolled={data.enrolled} moduleLocked={m.locked} onChanged={() => void load()} />
                    ) : item.kind === "quick_update" ? (
                      <QuickUpdateCard key={item.id} item={item} childId={child.id} enrolled={data.enrolled} moduleLocked={m.locked} onChanged={() => void load()} />
                    ) : item.kind === "mission" ? (
                      <MissionCard key={item.id} item={item} childId={child.id} enrolled={data.enrolled} moduleLocked={m.locked} onChanged={() => void load()} />
                    ) : (
                    <ItemCard
                      key={item.id}
                      item={item}
                      moduleLocked={m.locked}
                      open={openItem === item.id}
                      enrolled={data.enrolled}
                      onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
                      onStart={() => {
                        if (item.kind === "lesson" || item.kind === "quiz") {
                          const p = item.payload as { bncc_code?: string } | null;
                          if (p?.bncc_code) nav(`/aula?code=${encodeURIComponent(p.bncc_code)}&item=${item.id}&curso=${id}`);
                        }
                      }}
                      onDone={() => void markDone(item)}
                    />
                    )
                  ))}
                  {m.items.length === 0 && <div className="bm-meta">Conteúdo em preparação.</div>}
                </div>

                {/* Learning Backlog (Inteli) */}
                {m.backlog.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--bm-border)", paddingTop: ".6rem" }}>
                    <div className="bm-eyebrow" style={{ marginBottom: ".4rem" }}>
                      Learning backlog · {m.backlog.filter((a) => a.state === "mastered").length}/{m.backlog.length} dominados
                    </div>
                    <div style={{ display: "grid", gap: ".3rem" }}>
                      {m.backlog.map((a) => (
                        <div key={a.id} style={{ display: "flex", gap: ".5rem", alignItems: "baseline", fontSize: ".85rem" }}>
                          <span aria-hidden>{a.state === "mastered" ? "🟢" : a.state === "reviewing" ? "🟡" : "⚪"}</span>
                          <span style={{ color: a.state === "mastered" ? "var(--bm-ink)" : "var(--bm-muted)" }}>{a.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bm-meta" style={{ marginTop: ".45rem" }}>
                      A missão conclui quando todos os itens forem feitos <b>e</b> todos os conceitos estiverem 🟢 (dominar = lembrar de verdade).
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>

          {data.enrolled && id && <ExamsSection courseId={id} childId={child.id} />}
          {data.enrolled && id && <ExemplaresSection courseId={id} childId={child.id} />}
        </>
      )}
    </AppShell>
  );
}

// ---------- Provas do curso (spec 15.3) ----------
function ExamsSection({ courseId, childId }: { courseId: string; childId: string }) {
  const nav = useNavigate();
  const [exams, setExams] = useState<import("../lib/api").StudentExam[]>([]);
  useEffect(() => { api.examStudentList(courseId, childId).then((r) => setExams(r.exams)).catch(() => setExams([])); }, [courseId, childId]);
  if (exams.length === 0) return null;
  return (
    <section className="bm-card" style={{ marginTop: "1rem", display: "grid", gap: ".6rem" }}>
      <div className="bm-eyebrow">📝 Provas</div>
      {exams.map((e) => (
        <div key={e.id} className="bm-card-flat" style={{ padding: ".65rem .85rem", display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: ".92rem" }}>{e.title}</div>
            <div className="bm-meta">
              {e.duration_min ? `${e.duration_min} min · ` : ""}{e.attempts_used}/{e.attempts_allowed} tentativa(s)
              {e.best_score !== null ? ` · melhor ${Math.round(e.best_score * 100)}%` : ""}
              {e.due_at ? ` · até ${new Date(e.due_at).toLocaleDateString("pt-BR")}` : ""}
            </div>
          </div>
          {e.best_score !== null && <span className="bm-chip" style={{ color: "var(--bm-success)", fontSize: ".74rem" }}>{Math.round(e.best_score * 100)}%</span>}
          {e.can_start ? (
            <button className="bm-btn bm-btn-sm" onClick={() => nav(`/prova/${e.id}?curso=${courseId}`)}>{e.attempts_used > 0 ? "Refazer" : "Fazer prova"}</button>
          ) : !e.open_now ? <span className="bm-meta">fechada</span> : <span className="bm-meta">sem tentativas</span>}
        </div>
      ))}
    </section>
  );
}

// ---------- Tarefa (spec 15.4): entrega texto/arquivo + feedback do professor ----------
function AssignmentCard({ item, childId, enrolled, moduleLocked, onChanged }: {
  item: LearnItem; childId: string; enrolled: boolean; moduleLocked: boolean; onChanged: () => void;
}) {
  const p = (item.payload ?? {}) as { instructions?: string; max_points?: number };
  const locked = item.locked || moduleLocked;
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<import("../lib/api").StudentSubmission | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selfPoints, setSelfPoints] = useState("");
  const [selfReflection, setSelfReflection] = useState("");
  const [selfSavedAt, setSelfSavedAt] = useState<string | null>(null);
  const [selfBusy, setSelfBusy] = useState(false);

  useEffect(() => { if (open) api.mySubmission(item.id, childId).then((r) => { setSub(r.submission); setText(r.submission?.body_text ?? ""); }).catch(() => {}); }, [open, item.id, childId]);
  useEffect(() => {
    if (!sub) return;
    api.mySelfAssessment(sub.id).then((r) => {
      if (r.self_assessment) { setSelfPoints(String(r.self_assessment.points)); setSelfReflection(r.self_assessment.reflection ?? ""); setSelfSavedAt(r.self_assessment.created_at); }
    }).catch(() => {});
  }, [sub?.id]);

  async function sendSelfAssess() {
    if (!sub) return;
    setSelfBusy(true); setErr(null);
    try {
      const max = p.max_points ?? 100;
      const pts = Math.max(0, Math.min(max, Number(selfPoints)));
      await api.selfAssess(sub.id, { points: pts, reflection: selfReflection.trim() || null });
      setSelfSavedAt(new Date().toISOString());
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao salvar autoavaliação."); }
    finally { setSelfBusy(false); }
  }

  async function send() {
    setBusy(true); setErr(null);
    try {
      await api.submit(item.id, childId, text.trim() || null, null);
      const r = await api.mySubmission(item.id, childId); setSub(r.submission);
      onChanged();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao enviar."); } finally { setBusy(false); }
  }

  return (
    <div className="bm-card-flat" style={{ padding: ".65rem .85rem", display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
        <span aria-hidden>{locked ? "🔒" : "📝"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: ".92rem", color: locked ? "var(--bm-muted)" : "var(--bm-ink)" }}>{item.title}</span>
          {locked && item.lock_reason && <span className="bm-meta"> · {item.lock_reason}</span>}
        </div>
        {locked ? <span className="bm-meta">🔒 bloqueado</span>
          : item.progress.status === "done" ? <span className="bm-chip" style={{ color: "var(--bm-success)", fontSize: ".74rem" }}>✓ entregue</span>
          : !enrolled ? <span className="bm-meta">inscreva-se</span>
          : <button className="bm-btn bm-btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Abrir tarefa"}</button>}
      </div>
      {open && !locked && enrolled && (
        <div style={{ display: "grid", gap: ".5rem" }}>
          {p.instructions && <div className="bm-card" style={{ padding: ".6rem .8rem", background: "var(--bm-surface-2)", border: 0, fontSize: ".9rem", whiteSpace: "pre-wrap" }}>{p.instructions}</div>}
          {sub?.review && (
            <div className="bm-card-flat" style={{ padding: ".6rem .8rem", borderLeft: "3px solid var(--bm-success)" }}>
              <div className="bm-eyebrow">Feedback do professor{sub.review.points !== null ? ` · ${sub.review.points} pts` : ""}</div>
              <div style={{ fontSize: ".9rem" }}>{sub.review.feedback}</div>
            </div>
          )}
          <textarea className="bm-input" rows={4} placeholder="Escreva sua resposta…" value={text} onChange={(e) => setText(e.target.value)} style={{ resize: "vertical" }} />
          {err && <ErrorNote>{err}</ErrorNote>}
          <button className="bm-btn bm-btn-sm" disabled={busy || !text.trim()} onClick={send} style={{ justifySelf: "start" }}>
            {busy ? "Enviando…" : sub ? "Reenviar" : "Entregar"}
          </button>
          {sub && (
            <div className="bm-card-flat" style={{ padding: ".6rem .8rem", background: "var(--bm-surface-2)", display: "grid", gap: ".4rem" }}>
              <div className="bm-eyebrow">🪞 Como você avalia sua entrega?</div>
              <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                <input className="bm-input" type="number" min={0} max={p.max_points ?? 100} placeholder={`0–${p.max_points ?? 100}`} value={selfPoints} onChange={(e) => setSelfPoints(e.target.value)} style={{ width: 100 }} />
                <span className="bm-meta">de {p.max_points ?? 100} pts</span>
              </div>
              <textarea className="bm-input" rows={2} placeholder="O que você acha que fez bem? O que faltou?" value={selfReflection} onChange={(e) => setSelfReflection(e.target.value)} style={{ resize: "vertical" }} />
              <button className="bm-btn bm-btn-ghost bm-btn-sm" disabled={selfBusy || selfPoints === ""} onClick={sendSelfAssess} style={{ justifySelf: "start" }}>
                {selfBusy ? "Salvando…" : selfSavedAt ? "Atualizar autoavaliação" : "Salvar autoavaliação"}
              </button>
              {selfSavedAt && <div className="bm-meta">Salva em {new Date(selfSavedAt).toLocaleDateString("pt-BR")}.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, moduleLocked, open, enrolled, onToggle, onStart, onDone }: {
  item: LearnItem; moduleLocked: boolean; open: boolean; enrolled: boolean;
  onToggle: () => void; onStart: () => void; onDone: () => void;
}) {
  const p = (item.payload ?? {}) as { url?: string; file_id?: string; name?: string; bncc_code?: string };
  const done = item.progress.status === "done";
  const isAI = item.kind === "lesson" || item.kind === "quiz";
  const locked = item.locked || moduleLocked;

  return (
    <div className="bm-card-flat" style={{ padding: ".65rem .85rem", display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
        <span aria-hidden>{locked ? "🔒" : (KIND_ICON[item.kind] ?? "▫")}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: ".92rem", textDecoration: done ? "line-through" : "none", color: done || locked ? "var(--bm-muted)" : "var(--bm-ink)" }}>
            {item.title}
          </span>
          {locked && item.lock_reason && <span className="bm-meta"> · {item.lock_reason}</span>}
          {!locked && item.duration_min && <span className="bm-meta"> · ~{item.duration_min} min</span>}
        </div>
        {locked ? (
          <span className="bm-meta">🔒 bloqueado</span>
        ) : done ? (
          <span className="bm-chip" style={{ color: "var(--bm-success)", fontSize: ".74rem" }}>✓ feito</span>
        ) : !enrolled ? (
          <span className="bm-meta">inscreva-se</span>
        ) : isAI ? (
          <button className="bm-btn bm-btn-sm" onClick={onStart}>Estudar</button>
        ) : (
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={onToggle}>{open ? "Fechar" : "Abrir"}</button>
        )}
      </div>

      {open && enrolled && !isAI && (
        <div style={{ display: "grid", gap: ".6rem" }}>
          {item.kind === "video" && p.url && embedUrl(p.url) && (
            <iframe
              src={embedUrl(p.url)!}
              title={item.title}
              allow="accelerometer; encrypted-media; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              style={{ width: "100%", aspectRatio: "16/9", border: 0, borderRadius: 10 }}
            />
          )}
          {item.kind === "video" && p.file_id && (
            <video controls preload="metadata" src={`/api/files/${p.file_id}`} style={{ width: "100%", borderRadius: 10, background: "#000" }} />
          )}
          {item.kind === "document" && p.file_id && (
            <a className="bm-btn bm-btn-ghost" href={`/api/files/${p.file_id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", justifySelf: "start" }}>
              📄 Abrir {p.name ?? "documento"}
            </a>
          )}
          {!done && (
            <button className="bm-btn bm-btn-sm" onClick={onDone} style={{ justifySelf: "start" }}>
              Concluí este item ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Quick Update + Checklist (spec 17.1) ----------
function QuickUpdateCard({ item, childId, enrolled, moduleLocked, onChanged }: {
  item: LearnItem; childId: string; enrolled: boolean; moduleLocked: boolean; onChanged: () => void;
}) {
  const p = (item.payload ?? {}) as { body?: string; questions?: { prompt: string; options: string[]; correct: number }[]; checklist?: { label: string }[] };
  const locked = item.locked || moduleLocked;
  const done = item.progress.status === "done";
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [steps, setSteps] = useState<ChecklistStep[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && (p.checklist?.length ?? 0) > 0) api.checklist(item.id, childId).then((r) => setSteps(r.steps)).catch(() => {});
  }, [open, item.id, childId]);

  async function toggleStep(index: number) {
    await api.toggleChecklistStep(item.id, index, childId);
    const r = await api.checklist(item.id, childId);
    setSteps(r.steps);
  }

  async function finish() {
    setBusy(true);
    try {
      const qs = p.questions ?? [];
      const score = qs.length > 0 ? qs.filter((q, i) => answers[i] === q.correct).length / qs.length : 1;
      await api.learnItemProgress(item.id, childId, "done", score);
      onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div className="bm-card-flat" style={{ padding: ".65rem .85rem", display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
        <span aria-hidden>{locked ? "🔒" : "⚡"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: ".92rem", textDecoration: done ? "line-through" : "none", color: done || locked ? "var(--bm-muted)" : "var(--bm-ink)" }}>{item.title}</span>
          {locked && item.lock_reason && <span className="bm-meta"> · {item.lock_reason}</span>}
          {!locked && <span className="bm-meta"> · ~3 min</span>}
        </div>
        {locked ? <span className="bm-meta">🔒 bloqueado</span>
          : done ? <span className="bm-chip" style={{ color: "var(--bm-success)", fontSize: ".74rem" }}>✓ feito</span>
          : !enrolled ? <span className="bm-meta">inscreva-se</span>
          : <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Abrir"}</button>}
      </div>
      {open && enrolled && !locked && (
        <div style={{ display: "grid", gap: ".6rem" }}>
          {p.body && <div className="bm-card" style={{ padding: ".6rem .8rem", background: "var(--bm-surface-2)", border: 0, fontSize: ".9rem", whiteSpace: "pre-wrap" }}>{p.body}</div>}
          {(p.questions ?? []).map((q, qi) => (
            <div key={qi} style={{ display: "grid", gap: ".3rem" }}>
              <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{q.prompt}</div>
              <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap" }}>
                {q.options.map((o, oi) => (
                  <button key={oi} className={`bm-btn-sm ${answers[qi] === oi ? "bm-btn" : "bm-btn bm-btn-ghost"}`} disabled={done} onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}>{o}</button>
                ))}
              </div>
            </div>
          ))}
          {steps && steps.length > 0 && (
            <div style={{ display: "grid", gap: ".3rem" }}>
              <div className="bm-eyebrow">Passos</div>
              {steps.map((s) => (
                <label key={s.index} style={{ display: "flex", gap: ".5rem", alignItems: "center", fontSize: ".88rem" }}>
                  <input type="checkbox" checked={s.done} onChange={() => void toggleStep(s.index)} style={{ width: 18, height: 18 }} />
                  <span style={{ textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--bm-muted)" : "inherit" }}>{s.label}</span>
                </label>
              ))}
            </div>
          )}
          {!done && (
            <button className="bm-btn bm-btn-sm" disabled={busy} onClick={finish} style={{ justifySelf: "start" }}>
              {busy ? "Enviando…" : "Concluí este Quick Update ✓"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Mission (spec 17.5): gravação de áudio/vídeo + transcrição digitada ----------
function MissionCard({ item, childId, enrolled, moduleLocked, onChanged }: {
  item: LearnItem; childId: string; enrolled: boolean; moduleLocked: boolean; onChanged: () => void;
}) {
  const p = (item.payload ?? {}) as { prompt?: string; media_type?: "audio" | "video"; max_points?: number };
  const locked = item.locked || moduleLocked;
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<MissionSubmission | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open) api.myMission(item.id, childId).then((r) => setSub(r.submission)).catch(() => {}); }, [open, item.id, childId]);

  async function send() {
    if (!file) return;
    setErr(null); setBusy("Enviando arquivo…");
    try {
      const up = await api.missionUpload(file, childId);
      setBusy("Registrando…");
      await api.submitMission(item.id, childId, up.id, transcript.trim() || null);
      const r = await api.myMission(item.id, childId);
      setSub(r.submission);
      onChanged();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao enviar."); }
    finally { setBusy(null); }
  }

  return (
    <div className="bm-card-flat" style={{ padding: ".65rem .85rem", display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
        <span aria-hidden>{locked ? "🔒" : "🎙️"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: ".92rem", color: locked ? "var(--bm-muted)" : "var(--bm-ink)" }}>{item.title}</span>
          {locked && item.lock_reason && <span className="bm-meta"> · {item.lock_reason}</span>}
        </div>
        {locked ? <span className="bm-meta">🔒 bloqueado</span>
          : item.progress.status === "done" ? <span className="bm-chip" style={{ color: "var(--bm-success)", fontSize: ".74rem" }}>✓ enviada</span>
          : !enrolled ? <span className="bm-meta">inscreva-se</span>
          : <button className="bm-btn bm-btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Abrir missão"}</button>}
      </div>
      {open && !locked && enrolled && (
        <div style={{ display: "grid", gap: ".5rem" }}>
          {p.prompt && <div className="bm-card" style={{ padding: ".6rem .8rem", background: "var(--bm-surface-2)", border: 0, fontSize: ".9rem", whiteSpace: "pre-wrap" }}>{p.prompt}</div>}
          <div className="bm-meta">Requer autorização de gravação de mídia (em Configurações → Consentimentos).</div>
          {sub?.review && (
            <div className="bm-card-flat" style={{ padding: ".6rem .8rem", borderLeft: "3px solid var(--bm-success)" }}>
              <div className="bm-eyebrow">Feedback do professor{sub.review.points !== null ? ` · ${sub.review.points} pts` : ""}</div>
              <div style={{ fontSize: ".9rem" }}>{sub.review.feedback}</div>
            </div>
          )}
          {sub && (
            <div className="bm-meta">Envio de {new Date(sub.submitted_at).toLocaleDateString("pt-BR")} · retido até {new Date(sub.retention_until).toLocaleDateString("pt-BR")}.</div>
          )}
          <label className="bm-meta">Arquivo ({p.media_type === "video" ? "MP4/WEBM" : "MP3/M4A/WEBM/WAV"}):{" "}
            <input type="file" accept={p.media_type === "video" ? "video/mp4,video/webm" : "audio/mpeg,audio/mp4,audio/webm,audio/wav"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <textarea className="bm-input" rows={3} placeholder="Digite uma transcrição ou resumo do que você gravou (usado só para a pré-análise do professor — não há transcrição automática)." value={transcript} onChange={(e) => setTranscript(e.target.value)} style={{ resize: "vertical" }} />
          {err && <ErrorNote>{err}</ErrorNote>}
          <button className="bm-btn bm-btn-sm" disabled={!!busy || !file} onClick={send} style={{ justifySelf: "start" }}>
            {busy ?? (sub ? "Reenviar" : "Enviar missão")}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Exemplares de pares (spec 17.2) ----------
function ExemplaresSection({ courseId, childId }: { courseId: string; childId: string }) {
  const [exemplars, setExemplars] = useState<Exemplar[]>([]);
  useEffect(() => { api.courseExemplars(courseId, childId).then((r) => setExemplars(r.exemplars)).catch(() => setExemplars([])); }, [courseId, childId]);
  if (exemplars.length === 0) return null;
  return (
    <section className="bm-card" style={{ marginTop: "1rem", display: "grid", gap: ".6rem" }}>
      <div className="bm-eyebrow">🌟 Exemplos de colegas</div>
      {exemplars.map((e) => (
        <div key={e.id} className="bm-card-flat" style={{ padding: ".65rem .85rem", display: "grid", gap: ".3rem" }}>
          <div style={{ fontWeight: 620, fontSize: ".9rem" }}>{e.student}</div>
          {e.note && <div className="bm-meta">{e.note}</div>}
          {e.body_text && <div style={{ fontSize: ".88rem", whiteSpace: "pre-wrap" }}>{e.body_text}</div>}
        </div>
      ))}
    </section>
  );
}
