// Comunidade (spec 12.5): mural da instituição — posts, respostas, denunciar.
// Texto puro (React escapa por padrão); autor = apelido apenas.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote } from "../components/common";
import { api, ApiError } from "../lib/api";
import { useMe, useCommunityPosts, activeChild } from "../lib/queries";
import type { CommunityPost, CommunityReply } from "../../shared/contracts";

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function Comunidade() {
  const me = useMe();
  const qc = useQueryClient();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const posts = useCommunityPosts(child?.id ?? null);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  if (me.isLoading || (child && posts.isLoading)) {
    return <AppShell title="Comunidade"><BearLoader label="Carregando…" /></AppShell>;
  }
  if (!child) return null;

  if (openPost) {
    return (
      <AppShell title="Discussão">
        <PostDetail postId={openPost} childId={child.id} onBack={() => setOpenPost(null)} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Comunidade">
      <div style={{ display: "grid", gap: ".9rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, color: "var(--bm-muted)", fontSize: ".9rem" }}>
            Mural da sua instituição · seja gentil e ajude os colegas
          </p>
          <button className="bm-btn" onClick={() => setComposing((v) => !v)}>
            {composing ? "Fechar" : "+ Nova discussão"}
          </button>
        </div>

        {composing && (
          <Composer
            childId={child.id}
            onSaved={() => {
              setComposing(false);
              qc.invalidateQueries({ queryKey: ["community"] });
            }}
          />
        )}

        {(posts.data?.posts ?? []).length === 0 && !composing && (
          <div className="bm-card" style={{ textAlign: "center", color: "var(--bm-muted)" }}>
            Ainda não há discussões por aqui. Comece a primeira!
          </div>
        )}

        {(posts.data?.posts ?? []).map((p) => (
          <button key={p.id} className="bm-card" onClick={() => setOpenPost(p.id)} style={{ textAlign: "left", cursor: "pointer" }}>
            <div style={{ fontWeight: 650 }}>{p.title}</div>
            <div style={{ color: "var(--bm-muted)", fontSize: ".85rem", margin: ".25rem 0" }}>
              {p.body.length > 140 ? p.body.slice(0, 140) + "…" : p.body}
            </div>
            <div style={{ display: "flex", gap: ".9rem", color: "var(--bm-muted)", fontSize: ".78rem" }}>
              <span>por {p.author}</span>
              <span>{timeAgo(p.created_at)}</span>
              <span>💬 {p.replies ?? 0}</span>
            </div>
          </button>
        ))}
      </div>
    </AppShell>
  );
}

function Composer({ childId, onSaved }: { childId: string; onSaved: () => void }) {
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
    <div className="bm-card" style={{ display: "grid", gap: ".6rem" }}>
      <input className="bm-input" placeholder="Título da discussão" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
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
      <button className="bm-btn" disabled={busy || title.trim().length < 3 || !body.trim()} onClick={save}>
        {busy ? "Publicando…" : "Publicar"}
      </button>
    </div>
  );
}

function PostDetail({ postId, childId, onBack }: { postId: string; childId: string; onBack: () => void }) {
  const [data, setData] = useState<{ post: CommunityPost; replies: CommunityReply[] } | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api
      .getPost(postId, childId)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setErr("Não foi possível carregar."));
    return () => {
      cancelled = true;
    };
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
    } catch {
      /* silencioso */
    }
  }

  if (!data && !err) return <BearLoader label="Carregando discussão…" />;

  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <button className="bm-btn bm-btn-ghost" onClick={onBack} style={{ justifySelf: "start" }}>← Voltar</button>
      {err && <ErrorNote>{err}</ErrorNote>}
      {data && (
        <>
          <div className="bm-card">
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{data.post.title}</div>
            <p style={{ whiteSpace: "pre-wrap", margin: ".5rem 0" }}>{data.post.body}</p>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--bm-muted)", fontSize: ".78rem" }}>
              <span>por {data.post.author} · {timeAgo(data.post.created_at)}</span>
              <button
                onClick={() => report("post", data.post.id)}
                disabled={reported.has(data.post.id)}
                style={{ background: "none", border: 0, color: "var(--bm-muted)", cursor: "pointer", fontSize: ".78rem" }}
              >
                {reported.has(data.post.id) ? "denunciado ✓" : "denunciar"}
              </button>
            </div>
          </div>

          {data.replies.map((r) => (
            <div key={r.id} className="bm-card" style={{ marginLeft: "1rem" }}>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{r.body}</p>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--bm-muted)", fontSize: ".78rem", marginTop: ".4rem" }}>
                <span>{r.author} · {timeAgo(r.created_at)}</span>
                <button
                  onClick={() => report("reply", r.id)}
                  disabled={reported.has(r.id)}
                  style={{ background: "none", border: 0, color: "var(--bm-muted)", cursor: "pointer", fontSize: ".78rem" }}
                >
                  {reported.has(r.id) ? "denunciado ✓" : "denunciar"}
                </button>
              </div>
            </div>
          ))}

          <div className="bm-card" style={{ display: "grid", gap: ".5rem" }}>
            <textarea
              className="bm-input"
              placeholder="Escreva uma resposta…"
              value={reply}
              maxLength={2000}
              rows={3}
              onChange={(e) => setReply(e.target.value)}
              style={{ resize: "vertical" }}
            />
            <button className="bm-btn" disabled={busy || !reply.trim()} onClick={sendReply} style={{ justifySelf: "end" }}>
              {busy ? "Enviando…" : "Responder"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
