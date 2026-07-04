// Moderação (spec 14.6): fila de conteúdo denunciado — ocultar ou restaurar. institution_admin+.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError, type ModItem } from "../../lib/api";
import { useMe } from "../../lib/queries";

export function AdminModeracao() {
  const nav = useNavigate();
  const me = useMe();
  const role = me.data?.parent.role ?? "guardian";
  const [items, setItems] = useState<ModItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems((await api.moderation()).items); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao carregar."); }
  }, []);

  useEffect(() => { if (role === "institution_admin" || role === "platform_admin") void load(); }, [role, load]);

  if (me.isLoading) return <AppShell title="Moderação"><BearLoader /></AppShell>;
  if (role !== "institution_admin" && role !== "platform_admin") {
    return <AppShell title="Moderação"><ErrorNote>Área restrita a gestores da instituição.</ErrorNote></AppShell>;
  }

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }

  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav("/admin")} style={{ marginBottom: ".6rem" }}>← Administração</button>
      <div className="bm-page-head"><h1>Moderação</h1><div className="sub">Conteúdo denunciado pela comunidade, aguardando sua decisão.</div></div>
      {err && <ErrorNote>{err}</ErrorNote>}
      {!items ? <BearLoader label="Carregando fila…" /> : items.length === 0 ? (
        <div className="bm-card" style={{ textAlign: "center", padding: "2rem", color: "var(--bm-muted)" }}>
          🎉 Nada na fila. A comunidade está saudável.
        </div>
      ) : (
        <div style={{ display: "grid", gap: ".6rem" }}>
          {items.map((it) => (
            <div key={`${it.kind}:${it.id}`} className="bm-card" style={{ display: "grid", gap: ".5rem" }}>
              <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                <span className="bm-chip bm-chip-outline" style={{ fontSize: ".72rem" }}>{it.label}</span>
                <span className="bm-meta">{new Date(it.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <div style={{ fontSize: ".95rem" }}>{it.body}</div>
              <div style={{ display: "flex", gap: ".5rem" }}>
                <button className="bm-btn bm-btn-sm" style={{ background: "var(--bm-danger)" }} onClick={() => act(() => api.moderationHide(it.kind, it.id))}>Ocultar</button>
                <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => act(() => api.moderationRestore(it.kind, it.id))}>Manter (limpar denúncia)</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
