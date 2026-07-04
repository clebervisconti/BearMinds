// Shell da plataforma (spec 12.2, refinado a partir das referências UMGC/D2L + MIT/Olympus):
// top nav horizontal no desktop (logo · navegação · utilidades), bottom nav no mobile.
import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { useMe, useCoins, useNotifications, activeChild } from "../lib/queries";
import { Avatar } from "./common";

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
      {/* ---- Top bar ---- */}
      <header className="bm-topnav">
        <div className="bm-topnav-in">
          <Link to="/" className="bm-logo">
            <span className="bm-logo-mark" aria-hidden>🐻</span>
            <span className="bm-logo-txt">
              <strong>BearMinds</strong>
              <em>plataforma de estudos</em>
            </span>
          </Link>

          <nav className="bm-nav-desktop" aria-label="Principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `bm-navitem${isActive ? " active" : ""}`}>
                <span className="ic" aria-hidden>{n.icon}</span> {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="bm-utils">
            <span className="bm-chip bm-coins-chip" title="Moedas ganhas estudando">🪙 {coins.data?.balance ?? 0}</span>
            <Link to="/notificacoes" className="bm-iconbtn" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {unread > 0 && <span className="bm-badge">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <Link to="/configuracoes" className="bm-iconbtn bm-hide-mobile" aria-label="Configurações">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
            <Link to="/perfis" className="bm-profile" title="Trocar perfil">
              {child ? <Avatar name={child.display_name} size={32} /> : <span className="bm-avatar-i" style={{ width: 32, height: 32 }}>?</span>}
              <span className="bm-profile-name bm-hide-mobile">{child?.display_name ?? "Perfil"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ---- Conteúdo ---- */}
      <main className="bm-main" id="main">
        {title && (
          <div className="bm-page-head">
            <h1>{title}</h1>
          </div>
        )}
        {children}
      </main>

      <footer className="bm-footer">© 2026 BearMinds · aprender, não colar · <Link to="/politica-de-privacidade">privacidade</Link></footer>

      {/* ---- Bottom nav (mobile) ---- */}
      <nav className="bm-bottomnav" aria-label="Principal (mobile)">
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
        .bm-app{min-height:100dvh;display:flex;flex-direction:column}

        /* ---------- top nav ---------- */
        .bm-topnav{position:sticky;top:0;z-index:40;background:var(--bm-surface);border-bottom:1px solid var(--bm-border)}
        .bm-topnav-in{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:1.4rem;padding:.55rem 1.2rem;min-height:60px}
        .bm-logo{display:flex;align-items:center;gap:.55rem;text-decoration:none;color:var(--bm-ink)}
        .bm-logo-mark{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#3949ab,#5c6bc0);display:grid;place-items:center;font-size:1.05rem}
        .bm-logo-txt{display:flex;flex-direction:column;line-height:1.05}
        .bm-logo-txt strong{font-size:.98rem;letter-spacing:-.01em}
        .bm-logo-txt em{font-style:normal;font-size:.62rem;color:var(--bm-muted);letter-spacing:.04em}
        .bm-nav-desktop{display:none}
        .bm-utils{margin-left:auto;display:flex;align-items:center;gap:.45rem}
        .bm-coins-chip{font-weight:650}
        .bm-iconbtn{position:relative;display:grid;place-items:center;width:38px;height:38px;border-radius:10px;
          color:var(--bm-muted);text-decoration:none;transition:background .12s ease,color .12s ease}
        .bm-iconbtn:hover{background:var(--bm-surface-2);color:var(--bm-ink)}
        .bm-badge{position:absolute;top:3px;right:2px;background:var(--bm-danger);color:#fff;border-radius:999px;
          font-size:.6rem;font-weight:700;padding:.06rem .32rem;border:2px solid var(--bm-surface)}
        .bm-profile{display:flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--bm-ink);
          padding:.25rem .45rem;border-radius:10px;border:1px solid transparent}
        .bm-profile:hover{background:var(--bm-surface-2)}
        .bm-profile-name{font-weight:600;font-size:.88rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .bm-dot{position:absolute;top:6px;right:16px;width:7px;height:7px;border-radius:999px;background:var(--bm-danger)}

        /* ---------- conteúdo ---------- */
        .bm-main{flex:1;width:100%;max-width:1180px;margin:0 auto;padding:1.3rem 1rem calc(6rem + env(safe-area-inset-bottom))}
        .bm-footer{display:none;text-align:center;color:var(--bm-muted);font-size:.78rem;padding:1.2rem 0 1.6rem}
        .bm-footer a{color:var(--bm-muted)}

        /* ---------- bottom nav (mobile) ---------- */
        .bm-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;justify-content:space-around;
          background:var(--bm-surface);border-top:1px solid var(--bm-border);
          padding:.3rem .3rem calc(.3rem + env(safe-area-inset-bottom))}
        .bm-tab{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:.3rem .55rem;
          color:var(--bm-muted);text-decoration:none;font-size:.66rem;font-weight:550;border-radius:10px;min-width:54px}
        .bm-tab.active{color:var(--bm-primary)}
        .bm-tab .ic{font-size:1.12rem;line-height:1}

        @media (max-width: 919px){
          .bm-hide-mobile{display:none}
        }
        @media (min-width: 920px){
          .bm-bottomnav{display:none}
          .bm-footer{display:block}
          .bm-nav-desktop{display:flex;align-items:center;gap:.2rem}
          .bm-navitem{display:flex;align-items:center;gap:.45rem;padding:.5rem .85rem;border-radius:10px;
            color:var(--bm-muted);text-decoration:none;font-weight:550;font-size:.9rem;
            transition:background .12s ease,color .12s ease}
          .bm-navitem .ic{font-size:.95rem}
          .bm-navitem:hover{background:var(--bm-surface-2);color:var(--bm-ink)}
          .bm-navitem.active{color:var(--bm-primary);background:color-mix(in srgb, var(--bm-primary) 8%, transparent);font-weight:650}
          .bm-main{padding:1.8rem 1.5rem 3rem}
        }
      `}</style>
    </div>
  );
}
