// Shell da plataforma (spec 12.2): sidebar no desktop, top bar + bottom nav no mobile.
// Formal, calmo, sem ruído — skins infantis ficam restritas à Aula (não ao shell).
import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { useMe, useCoins, useNotifications, activeChild } from "../lib/queries";

const NAV = [
  { to: "/", icon: "▦", label: "Início" },
  { to: "/cursos", icon: "▤", label: "Cursos" },
  { to: "/atividades", icon: "✎", label: "Atividades" },
  { to: "/comunidade", icon: "◩", label: "Comunidade" },
  { to: "/conquistas", icon: "◇", label: "Conquistas" },
];

export function AppShell({ title, children }: { title?: string; children: ReactNode }) {
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const coins = useCoins(child?.id ?? null);
  const notifs = useNotifications(child?.id ?? null);
  const unread = notifs.data?.unread ?? 0;

  return (
    <div className="bm-app">
      {/* ---- Sidebar (desktop) ---- */}
      <aside className="bm-sidebar">
        <Link to="/" className="bm-logo">
          <span aria-hidden>🐻</span> <strong>BearMinds</strong>
        </Link>
        <nav className="bm-side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `bm-side-item${isActive ? " active" : ""}`}>
              <span className="ic" aria-hidden>{n.icon}</span> {n.label}
            </NavLink>
          ))}
          <NavLink to="/notificacoes" className={({ isActive }) => `bm-side-item${isActive ? " active" : ""}`}>
            <span className="ic" aria-hidden>◈</span> Notificações
            {unread > 0 && <span className="bm-badge">{unread}</span>}
          </NavLink>
          <NavLink to="/configuracoes" className={({ isActive }) => `bm-side-item${isActive ? " active" : ""}`}>
            <span className="ic" aria-hidden>⚙</span> Configurações
          </NavLink>
        </nav>
        <div className="bm-side-footer">
          <div className="bm-coins" title="Moedas ganhas estudando">🪙 {coins.data?.balance ?? 0}</div>
          <Link to="/perfis" className="bm-profile-chip" title="Trocar perfil">
            <span className="bm-avatar" aria-hidden>{child?.kind === "self" ? "🎓" : "🐻"}</span>
            <span className="nm">{child?.display_name ?? "Perfil"}</span>
          </Link>
        </div>
      </aside>

      {/* ---- Top bar (mobile) ---- */}
      <header className="bm-topbar">
        <Link to="/" className="bm-logo"><span aria-hidden>🐻</span> <strong>BearMinds</strong></Link>
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
          <span className="bm-coins">🪙 {coins.data?.balance ?? 0}</span>
          <Link to="/notificacoes" className="bm-bell" aria-label="Notificações">
            ◈{unread > 0 && <span className="bm-badge">{unread}</span>}
          </Link>
        </div>
      </header>

      {/* ---- Conteúdo ---- */}
      <main className="bm-main" id="main">
        {title && <h1 className="bm-page-title">{title}</h1>}
        {children}
      </main>

      {/* ---- Bottom nav (mobile) ---- */}
      <nav className="bm-bottomnav">
        {NAV.slice(0, 4).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `bm-tab${isActive ? " active" : ""}`}>
            <span className="ic" aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <NavLink to="/mais" className={({ isActive }) => `bm-tab${isActive ? " active" : ""}`}>
          <span className="ic" aria-hidden>☰</span>
          Mais{unread > 0 && <span className="bm-dot" aria-hidden />}
        </NavLink>
      </nav>

      <style>{`
        .bm-app{min-height:100dvh}
        .bm-logo{display:flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--bm-ink);font-size:1.05rem}
        .bm-coins{background:var(--bm-surface-2);border-radius:999px;padding:.25rem .7rem;font-weight:600;font-size:.9rem;white-space:nowrap}
        .bm-badge{background:var(--bm-danger);color:#fff;border-radius:999px;font-size:.68rem;font-weight:700;
          padding:.05rem .4rem;margin-left:auto}
        .bm-dot{position:absolute;top:6px;right:18px;width:8px;height:8px;border-radius:999px;background:var(--bm-danger)}
        .bm-page-title{font-size:1.35rem;margin:0 0 1.1rem}

        /* sidebar */
        .bm-sidebar{display:none}
        .bm-topbar{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;align-items:center;
          padding:.7rem 1rem;background:var(--bm-surface);border-bottom:1px solid var(--bm-border)}
        .bm-bell{position:relative;text-decoration:none;color:var(--bm-ink);font-size:1.15rem;display:flex;align-items:center;gap:2px}
        .bm-bell .bm-badge{margin-left:2px}
        .bm-main{max-width:960px;margin:0 auto;padding:1.1rem 1rem calc(6rem + env(safe-area-inset-bottom))}

        .bm-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;justify-content:space-around;
          background:var(--bm-surface);border-top:1px solid var(--bm-border);
          padding:.35rem .3rem calc(.35rem + env(safe-area-inset-bottom))}
        .bm-tab{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:.3rem .6rem;
          color:var(--bm-muted);text-decoration:none;font-size:.7rem;border-radius:10px;min-width:56px}
        .bm-tab.active{color:var(--bm-primary);background:var(--bm-surface-2)}
        .bm-tab .ic{font-size:1.15rem;line-height:1}

        @media (min-width: 900px){
          .bm-topbar,.bm-bottomnav{display:none}
          .bm-app{display:grid;grid-template-columns:230px 1fr}
          .bm-sidebar{display:flex;flex-direction:column;gap:1.2rem;position:sticky;top:0;height:100dvh;
            padding:1.2rem .9rem;background:var(--bm-surface);border-right:1px solid var(--bm-border)}
          .bm-side-nav{display:flex;flex-direction:column;gap:.15rem;flex:1}
          .bm-side-item{display:flex;align-items:center;gap:.65rem;padding:.55rem .7rem;border-radius:10px;
            color:var(--bm-muted);text-decoration:none;font-weight:500;font-size:.93rem}
          .bm-side-item .ic{width:1.2rem;text-align:center;font-size:1rem}
          .bm-side-item:hover{background:var(--bm-surface-2)}
          .bm-side-item.active{color:var(--bm-primary);background:var(--bm-surface-2);font-weight:600}
          .bm-side-footer{display:flex;flex-direction:column;gap:.6rem}
          .bm-profile-chip{display:flex;align-items:center;gap:.55rem;padding:.5rem .6rem;border:1px solid var(--bm-border);
            border-radius:10px;text-decoration:none;color:var(--bm-ink)}
          .bm-profile-chip .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:.9rem}
          .bm-avatar{font-size:1.2rem}
          .bm-main{padding:1.6rem 2rem 3rem;max-width:1080px}
        }
      `}</style>
    </div>
  );
}
