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
                  {m.complete && <span className="bm-chip" style={{ color: "var(--bm-success)", fontWeight: 700 }}>✓ dominada</span>}
                </div>

                {/* itens */}
                <div style={{ display: "grid", gap: ".5rem" }}>
                  {m.items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
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
        </>
      )}
    </AppShell>
  );
}

function ItemCard({ item, open, enrolled, onToggle, onStart, onDone }: {
  item: LearnItem; open: boolean; enrolled: boolean;
  onToggle: () => void; onStart: () => void; onDone: () => void;
}) {
  const p = (item.payload ?? {}) as { url?: string; file_id?: string; name?: string; bncc_code?: string };
  const done = item.progress.status === "done";
  const isAI = item.kind === "lesson" || item.kind === "quiz";

  return (
    <div className="bm-card-flat" style={{ padding: ".65rem .85rem", display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
        <span aria-hidden>{KIND_ICON[item.kind] ?? "▫"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: ".92rem", textDecoration: done ? "line-through" : "none", color: done ? "var(--bm-muted)" : "var(--bm-ink)" }}>
            {item.title}
          </span>
          {item.duration_min && <span className="bm-meta"> · ~{item.duration_min} min</span>}
        </div>
        {done ? (
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
