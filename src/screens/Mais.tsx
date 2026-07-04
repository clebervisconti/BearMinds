// "Mais" (mobile): atalhos para as áreas fora da bottom nav.
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useMe, useNotifications, activeChild } from "../lib/queries";

export function Mais() {
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const notifs = useNotifications(child?.id ?? null);
  const unread = notifs.data?.unread ?? 0;

  const isStaff = (me.data?.parent.role ?? "guardian") !== "guardian";
  const items = [
    ...(!isStaff ? [{ to: "/live", icon: "📡", label: "Ao vivo", desc: "Entrar num jogo com um PIN" }] : []),
    { to: "/conquistas", icon: "◇", label: "Conquistas", desc: "Moedas, medalhas e ranking" },
    { to: "/notificacoes", icon: "◈", label: "Notificações", desc: unread > 0 ? `${unread} não lida${unread === 1 ? "" : "s"}` : "Tudo em dia" },
    { to: "/perfis", icon: "👥", label: "Perfis", desc: "Trocar quem está estudando" },
    { to: "/configuracoes", icon: "⚙", label: "Configurações", desc: "Conta, consentimentos e dados" },
    ...(isStaff ? [{ to: "/admin", icon: "⚙", label: "Administração", desc: "Cursos, coaching e moderação" }] : []),
  ];

  return (
    <AppShell title="Mais">
      <div style={{ display: "grid", gap: ".6rem" }}>
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="bm-card" style={{ display: "flex", alignItems: "center", gap: ".9rem", textDecoration: "none", color: "inherit" }}>
            <span style={{ fontSize: "1.3rem", width: "1.6rem", textAlign: "center" }} aria-hidden>{i.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 650 }}>{i.label}</div>
              <div style={{ color: "var(--bm-muted)", fontSize: ".82rem" }}>{i.desc}</div>
            </div>
            <span style={{ color: "var(--bm-muted)" }}>→</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
