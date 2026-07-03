// Conquistas (specs 12.3–12.4): moedas, badges e leaderboard DA INSTITUIÇÃO.
import { AppShell } from "../components/AppShell";
import { BearLoader } from "../components/common";
import { useMe, useCoins, useLeaderboard, activeChild } from "../lib/queries";

const BADGES: { code: string; icon: string; label: string; hint: string }[] = [
  { code: "first_lesson", icon: "🎯", label: "Primeira missão", hint: "Complete sua primeira revisão" },
  { code: "streak_7", icon: "🔥", label: "7 dias seguidos", hint: "Estude 7 dias em sequência" },
  { code: "streak_30", icon: "🌟", label: "30 dias seguidos", hint: "Estude 30 dias em sequência" },
  { code: "atoms_10", icon: "🧠", label: "10 conceitos", hint: "Domine 10 conceitos" },
  { code: "atoms_50", icon: "🏛️", label: "50 conceitos", hint: "Domine 50 conceitos" },
  { code: "prova_ready_80", icon: "📗", label: "80% pronto", hint: "Chegue a 80% de prontidão numa prova" },
];

const REASON_LABEL: Record<string, string> = {
  review: "Revisão concluída",
  atom_mastered: "Conceito dominado",
  streak_7: "Marco: 7 dias",
  streak_30: "Marco: 30 dias",
};

export function Conquistas() {
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const coins = useCoins(child?.id ?? null);
  const board = useLeaderboard(child?.id ?? null);

  if (me.isLoading || (child && coins.isLoading)) {
    return <AppShell title="Conquistas"><BearLoader label="Carregando…" /></AppShell>;
  }
  if (!child) return null;

  const unlocked = new Set((coins.data?.achievements ?? []).map((a) => a.code));

  return (
    <AppShell title="Conquistas">
      <div style={{ display: "grid", gap: "1.1rem" }}>
        {/* saldo */}
        <section className="bm-card" style={{ display: "flex", gap: "1.6rem", alignItems: "center" }}>
          <div style={{ fontSize: "2.2rem" }} aria-hidden>🪙</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 750 }}>{coins.data?.balance ?? 0} moedas</div>
            <div style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>
              +{coins.data?.week ?? 0} nesta semana · moedas nascem de aprendizagem real, nunca de tempo de tela
            </div>
          </div>
        </section>

        {/* badges */}
        <section>
          <h2 style={{ fontSize: "1.05rem" }}>Medalhas</h2>
          <div className="bm-badges">
            {BADGES.map((b) => {
              const has = unlocked.has(b.code);
              return (
                <div key={b.code} className="bm-card" style={{ textAlign: "center", opacity: has ? 1 : 0.45 }} title={b.hint}>
                  <div style={{ fontSize: "1.7rem", filter: has ? "none" : "grayscale(1)" }} aria-hidden>{b.icon}</div>
                  <div style={{ fontWeight: 650, fontSize: ".85rem", marginTop: ".25rem" }}>{b.label}</div>
                  <div style={{ color: "var(--bm-muted)", fontSize: ".72rem" }}>{has ? "conquistada" : b.hint}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* leaderboard da instituição */}
        <section>
          <h2 style={{ fontSize: "1.05rem" }}>Ranking da semana — {board.data?.institution ?? "sua instituição"}</h2>
          {child.leaderboard_hidden && (
            <p style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>
              Seu perfil está oculto do ranking (é possível reativar em Configurações).
            </p>
          )}
          {(board.data?.entries ?? []).length === 0 ? (
            <div className="bm-card" style={{ color: "var(--bm-muted)", textAlign: "center" }}>
              Ninguém pontuou esta semana ainda — a primeira revisão coloca você no topo. 😉
            </div>
          ) : (
            <div className="bm-card" style={{ padding: 0, overflow: "hidden" }}>
              {board.data!.entries.map((e) => (
                <div
                  key={e.rank}
                  style={{
                    display: "flex", alignItems: "center", gap: ".8rem", padding: ".6rem .9rem",
                    borderBottom: "1px solid var(--bm-border)",
                    background: e.me ? "var(--bm-surface-2)" : "transparent",
                  }}
                >
                  <span style={{ width: "1.8rem", fontWeight: 700, color: e.rank <= 3 ? "var(--bm-warn)" : "var(--bm-muted)" }}>
                    {e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : `${e.rank}º`}
                  </span>
                  <span style={{ flex: 1, fontWeight: e.me ? 700 : 500 }}>
                    {e.display_name} {e.me && <em style={{ color: "var(--bm-muted)", fontStyle: "normal" }}>(você)</em>}
                  </span>
                  <span style={{ fontWeight: 650 }}>🪙 {e.coins}</span>
                </div>
              ))}
            </div>
          )}
          {board.data && board.data.me.rank === null && board.data.me.coins > 0 && !child.leaderboard_hidden && (
            <p style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>Você: 🪙 {board.data.me.coins} esta semana.</p>
          )}
        </section>

        {/* extrato */}
        {(coins.data?.ledger ?? []).length > 0 && (
          <section>
            <h2 style={{ fontSize: "1.05rem" }}>Últimas moedas</h2>
            <div className="bm-card" style={{ padding: 0, overflow: "hidden" }}>
              {coins.data!.ledger.slice(0, 10).map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: ".55rem .9rem", borderBottom: "1px solid var(--bm-border)", fontSize: ".88rem" }}>
                  <span>{REASON_LABEL[l.reason] ?? l.reason}</span>
                  <span style={{ fontWeight: 650, color: "var(--bm-success)" }}>+{l.delta}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <style>{`
        .bm-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem}
        @media(min-width:900px){.bm-badges{grid-template-columns:repeat(6,1fr)}}
      `}</style>
    </AppShell>
  );
}
