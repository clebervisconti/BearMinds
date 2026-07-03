// Notificações (spec 12.6): persistentes + derivadas, marcar como lida.
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { BearLoader } from "../components/common";
import { api } from "../lib/api";
import { useMe, useNotifications, activeChild } from "../lib/queries";

const KIND_ICON: Record<string, string> = {
  achievement: "🏅",
  reply: "💬",
  reviews_due: "⏰",
  prova_soon: "📅",
  system: "ℹ️",
};

export function Notificacoes() {
  const me = useMe();
  const qc = useQueryClient();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const notifs = useNotifications(child?.id ?? null);

  if (me.isLoading || (child && notifs.isLoading)) {
    return <AppShell title="Notificações"><BearLoader label="Carregando…" /></AppShell>;
  }
  if (!child) return null;

  const items = notifs.data?.items ?? [];
  const hasUnreadPersistent = items.some((i) => !i.derived && !i.read);

  async function markAll() {
    await api.markNotificationsRead({ all: true });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <AppShell title="Notificações">
      <div style={{ display: "grid", gap: ".6rem" }}>
        {hasUnreadPersistent && (
          <button className="bm-btn bm-btn-ghost" onClick={markAll} style={{ justifySelf: "end" }}>
            Marcar todas como lidas
          </button>
        )}
        {items.length === 0 && (
          <div className="bm-card" style={{ textAlign: "center", color: "var(--bm-muted)" }}>
            Nada por aqui. Bom sinal: você está em dia. ✓
          </div>
        )}
        {items.map((n, i) => {
          const inner = (
            <div style={{ display: "flex", gap: ".7rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.2rem" }} aria-hidden>{KIND_ICON[n.kind] ?? "•"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                {n.body && <div style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>{n.body}</div>}
              </div>
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--bm-primary)", marginTop: 6 }} aria-hidden />}
            </div>
          );
          return n.link ? (
            <Link key={n.id ?? `d${i}`} to={n.link} className="bm-card" style={{ textDecoration: "none", color: "inherit" }}>
              {inner}
            </Link>
          ) : (
            <div key={n.id ?? `d${i}`} className="bm-card">{inner}</div>
          );
        })}
      </div>
    </AppShell>
  );
}
