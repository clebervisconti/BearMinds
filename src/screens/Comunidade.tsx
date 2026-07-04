// Comunidade (spec 12.5) — referência MIT/Olympus: banner da comunidade, composer
// "no que você está pensando?", feed de posts com ações, trilho de top contribuidores.
// Texto puro (React escapa por padrão); autor = apelido apenas.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { Avatar, BearLoader, ErrorNote } from "../components/common";
import { api, ApiError } from "../lib/api";
import { useMe, useCommunityPosts, useLeaderboard, activeChild } from "../lib/queries";
import type { CommunityPost, CommunityReply } from "../../shared/contracts";

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

const RANK_BG = ["#1e1e1e", "#565656", "#8a8a8a"];

export function Comunidade() {
  const me = useMe();
  const qc = useQueryClient();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const posts = useCommunityPosts(child?.id ?? null);
  const board = useLeaderboard(child?.id ?? null);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  if (me.isLoading || (child && posts.isLoading)) {
    return <AppShell title="Comunidade"><BearLoader label="Carregando…" /></AppShell>;
  }
  if (!child) return null;

  if (openPost) {
    return (
      <AppShell>
        <PostDetail postId={openPost} childId={child.id} childName={child.display_name} onBack={() => setOpenPost(null)} />
      </AppShell>
    );
  }

  const list = posts.data?.posts ?? [];

  return (
    <AppShell>
      <div className="bm-comm">
        {/* ================= feed ================= */}
        <div style={{ display: "grid", gap: "1rem", alignContent: "start", minWidth: 0 }}>
          {/* banner */}
          <div className="bm-comm-banner">
            <div>
              <div className="bm-eyebrow" style={{ color: "rgba(255,255,255,.75)" }}>Comunidade</div>
              <h1 style={{ color: "#fff", margin: ".15rem 0 0", fontSize: "1.35rem" }}>
                {board.data?.institution ?? "Sua instituição"}
              </h1>
              <p style={{ color: "rgba(255,255,255,.85)", margin: ".3rem 0 0", fontSize: ".88rem" }}>
                Dúvidas, dicas de estudo e colaboração entre colegas. Seja gentil. 🤝
              </p>
            </div>
          </div>

          {/* composer */}
          <div className="bm-card" style={{ display: "flex", gap: ".75rem", alignItems: "flex-start" }}>
            <Avatar name={child.display_name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {!composing ? (
                <button
                  className="bm-input"
                  style={{ textAlign: "left", color: "var(--bm-muted)", cursor: "text" }}
                  onClick={() => setComposing(true)}
                >
                  No que você está pensando, {child.display_name}?
                </button>
              ) : (
                <Composer
                  childId={child.id}
                  onCancel={() => setComposing(false)}
                  onSaved={() => {
                    setComposing(false);
                    qc.invalidateQueries({ queryKey: ["community"] });
                  }}
                />
              )}
            </div>
          </div>

          {/* posts */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="bm-eyebrow">Publicações</div>
            <span className="bm-meta">mais recentes primeiro</span>
          </div>

          {list.length === 0 && (
            <div className="bm-card" style={{ textAlign: "center", color: "var(--bm-muted)", padding: "2rem 1rem" }}>
              Ainda não há discussões por aqui.<br />Comece a primeira — alguém pode estar com a mesma dúvida.
            </div>
          )}

          {list.map((p) => (
            <button key={p.id} className="bm-card" onClick={() => setOpenPost(p.id)} style={{ textAlign: "left", cursor: "pointer", display: "grid", gap: ".5rem" }}>
              <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
                <Avatar name={p.author} size={32} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 620, fontSize: ".88rem" }}>{p.author}</span>
                  <span className="bm-meta"> · {timeAgo(p.created_at)}</span>
                </div>
              </div>
              <div style={{ fontWeight: 650, fontSize: "1.02rem" }}>{p.title}</div>
              <div style={{ color: "var(--bm-muted)", fontSize: ".9rem" }}>
                {p.body.length > 180 ? p.body.slice(0, 180) + "…" : p.body}
              </div>
              <div className="bm-meta" style={{ display: "flex", gap: "1rem" }}>
                <span>💬 {p.replies ?? 0} {p.replies === 1 ? "resposta" : "respostas"}</span>
                <span style={{ color: "var(--bm-link)", fontWeight: 600 }}>participar →</span>
              </div>
            </button>
          ))}
        </div>

        {/* ================= trilho direito ================= */}
        <aside style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          <div className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
            <div className="bm-eyebrow" style={{ marginBottom: ".6rem" }}>Top contribuidores da semana</div>
            {(board.data?.entries ?? []).length === 0 ? (
              <p className="bm-meta" style={{ margin: 0 }}>A primeira revisão da semana coloca alguém aqui. 😉</p>
            ) : (
              <div style={{ display: "grid", gap: ".45rem" }}>
                {board.data!.entries.slice(0, 5).map((e) => (
                  <div key={e.rank} style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                    <span style={{
                      minWidth: 26, height: 22, borderRadius: 6, display: "grid", placeItems: "center",
                      fontSize: ".68rem", fontWeight: 700, color: "#fff",
                      background: RANK_BG[e.rank - 1] ?? "var(--bm-muted)",
                    }}>#{e.rank}</span>
                    <Avatar name={e.display_name} size={26} />
                    <span style={{ flex: 1, fontSize: ".86rem", fontWeight: e.me ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.display_name}{e.me ? " (você)" : ""}
                    </span>
                    <span style={{ fontSize: ".8rem", fontWeight: 650 }}>🪙 {e.coins}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
            <div className="bm-eyebrow" style={{ marginBottom: ".5rem" }}>Combinados da comunidade</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--bm-muted)", fontSize: ".84rem", display: "grid", gap: ".3rem" }}>
              <li>Explique como você pensou — não dê só a resposta.</li>
              <li>Respeito sempre; somos colegas de estudo.</li>
              <li>Viu algo fora do combinado? Use “denunciar”.</li>
            </ul>
          </div>
        </aside>
      </div>

      <style>{`
        .bm-comm{display:grid;gap:1rem}
        .bm-comm-banner{border-radius:var(--bm-radius);padding:1.4rem 1.4rem;min-height:110px;display:flex;align-items:flex-end;
          background:linear-gradient(120deg,#1e1e1e 0%,#123a00 130%);
          background-size:cover;box-shadow:var(--bm-shadow)}
        @media(min-width:920px){.bm-comm{grid-template-columns:minmax(0,1fr) 300px;gap:1.4rem}}
      `}</style>
    </AppShell>
  );
}

function Composer({ childId, onSaved, onCancel }: { childId: string; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      await api.createPost({ child_id: childId, title: title.trim(), body: body.trim() });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao publicar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: ".55rem" }}>
      <input className="bm-input" placeholder="Título da discussão" value={title} maxLength={120} autoFocus onChange={(e) => setTitle(e.target.value)} />
      <textarea
        className="bm-input"
        placeholder="Compartilhe uma dúvida, uma dica de estudo…"
        value={body}
        maxLength={2000}
        rows={4}
        onChange={(e) => setBody(e.target.value)}
        style={{ resize: "vertical", minHeight: 90 }}
      />
      {err && <ErrorNote>{err}</ErrorNote>}
      <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
        <button className="bm-btn-quiet bm-btn-sm" onClick={onCancel}>Cancelar</button>
        <button className="bm-btn bm-btn-sm" disabled={busy || title.trim().length < 3 || !body.trim()} onClick={save}>
          {busy ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </div>
  );
}

function PostDetail({ postId, childId, childName, onBack }: { postId: string; childId: string; childName: string; onBack: () => void }) {
  const [data, setData] = useState<{ post: CommunityPost; replies: CommunityReply[] } | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api.getPost(postId, childId)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setErr("Não foi possível carregar."));
    return () => { cancelled = true; };
  }, [postId, childId]);

  async function sendReply() {
    setBusy(true);
    setErr(null);
    try {
      await api.replyPost(postId, childId, reply.trim());
      setReply("");
      setData(await api.getPost(postId, childId));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao responder.");
    } finally {
      setBusy(false);
    }
  }

  async function report(kind: "post" | "reply", id: string) {
    try {
      await api.reportContent(kind, id);
      setReported((s) => new Set(s).add(id));
    } catch { /* silencioso */ }
  }

  if (!data && !err) return <BearLoader label="Carregando discussão…" />;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: ".8rem" }}>
      <button className="bm-btn-quiet bm-btn-sm" onClick={onBack} style={{ justifySelf: "start" }}>← Comunidade</button>
      {err && <ErrorNote>{err}</ErrorNote>}
      {data && (
        <>
          <article className="bm-card" style={{ display: "grid", gap: ".6rem" }}>
            <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
              <Avatar name={data.post.author} />
              <div>
                <div style={{ fontWeight: 650, fontSize: ".92rem" }}>{data.post.author}</div>
                <div className="bm-meta">{timeAgo(data.post.created_at)}</div>
              </div>
            </div>
            <h1 style={{ fontSize: "1.2rem", margin: 0 }}>{data.post.title}</h1>
            <p style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{data.post.body}</p>
            <div style={{ display: "flex", gap: "1.1rem", borderTop: "1px solid var(--bm-border)", paddingTop: ".6rem" }}>
              <span className="bm-meta">💬 {data.replies.length} {data.replies.length === 1 ? "resposta" : "respostas"}</span>
              <button
                onClick={() => report("post", data.post.id)}
                disabled={reported.has(data.post.id)}
                className="bm-btn-quiet bm-btn-sm"
                style={{ marginLeft: "auto", fontSize: ".78rem" }}
              >
                {reported.has(data.post.id) ? "denunciado ✓" : "🚩 denunciar"}
              </button>
            </div>
          </article>

          {data.replies.map((r) => (
            <div key={r.id} className="bm-card-flat" style={{ padding: ".9rem 1.1rem", marginLeft: "1.4rem", display: "grid", gap: ".4rem" }}>
              <div style={{ display: "flex", gap: ".55rem", alignItems: "center" }}>
                <Avatar name={r.author} size={26} />
                <span style={{ fontWeight: 620, fontSize: ".86rem" }}>{r.author}</span>
                <span className="bm-meta">· {timeAgo(r.created_at)}</span>
                <button
                  onClick={() => report("reply", r.id)}
                  disabled={reported.has(r.id)}
                  className="bm-btn-quiet bm-btn-sm"
                  style={{ marginLeft: "auto", fontSize: ".74rem" }}
                >
                  {reported.has(r.id) ? "✓" : "🚩"}
                </button>
              </div>
              <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: ".92rem" }}>{r.body}</p>
            </div>
          ))}

          <div className="bm-card" style={{ display: "flex", gap: ".7rem", alignItems: "flex-start" }}>
            <Avatar name={childName} size={32} />
            <div style={{ flex: 1, display: "grid", gap: ".5rem" }}>
              <textarea
                className="bm-input"
                placeholder="Escreva uma resposta…"
                value={reply}
                maxLength={2000}
                rows={3}
                onChange={(e) => setReply(e.target.value)}
                style={{ resize: "vertical" }}
              />
              <button className="bm-btn bm-btn-sm" disabled={busy || !reply.trim()} onClick={sendReply} style={{ justifySelf: "end" }}>
                {busy ? "Enviando…" : "Responder"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
