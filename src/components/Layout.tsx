import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

// Shell do modo criança: conteúdo + navegação inferior. Sem controles de responsável (gate).
export function Layout({ title, streak, children }: { title?: string; streak?: number; children: ReactNode }) {
  return (
    <div className="bm-shell" style={{ paddingBottom: "5.5rem" }}>
      {(title || streak !== undefined) && (
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <strong>{title}</strong>
          {streak !== undefined && streak > 0 && (
            <span className="bm-card" style={{ padding: ".25rem .6rem" }} title="Dias seguidos aprendendo">
              🔥 {streak}
            </span>
          )}
        </header>
      )}
      <main id="main">{children}</main>
      <nav className="bm-bottomnav">
        <Tab to="/" label="Início" icon="🏠" />
        <Tab to="/estudar" label="Estudar" icon="✨" />
        <Tab to="/responsavel" label="Responsável" icon="👨‍👩‍👧" />
      </nav>
      <style>{`
        .bm-bottomnav{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;
          background:var(--bm-surface);border-top:1px solid var(--bm-border);
          padding:.4rem .4rem calc(.4rem + env(safe-area-inset-bottom));z-index:20}
        .bm-tab{display:flex;flex-direction:column;align-items:center;gap:2px;padding:.3rem .8rem;
          color:var(--bm-muted);text-decoration:none;font-size:.75rem;border-radius:12px;min-width:64px}
        .bm-tab.active{color:var(--bm-primary);background:var(--bm-surface-2)}
        .bm-tab .ic{font-size:1.3rem}
      `}</style>
    </div>
  );
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => `bm-tab${isActive ? " active" : ""}`}>
      <span className="ic" aria-hidden>
        {icon}
      </span>
      {label}
    </NavLink>
  );
}
