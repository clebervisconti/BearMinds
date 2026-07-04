// Página do curso (spec 13.4) — módulos como missões, Learning Backlog visível (Inteli),
// player de itens (vídeo/documento inline; lição/quiz → LearningExperience) e conclusão mastery-gated.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote, Progress } from "../components/common";
import { api, ApiError, type LearnCourse, type LearnItem } from "../lib/api";
import { useMe, activeChild } from "../lib/queries";

const KIND_ICON: Record<string, string> = {
  video: "🎬", document: "📄", lesson: "📖", quiz: "✍️", game: "🎮", live: "📡",
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

  useEffect(() => { if (open) api.mySubmission(item.id, childId).then((r) => { setSub(r.submission); setText(r.submission?.body_text ?? ""); }).catch(() => {}); }, [open, item.id, childId]);

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
