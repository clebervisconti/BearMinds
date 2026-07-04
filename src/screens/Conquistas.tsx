// Conquistas (specs 12.3–12.4) — hero de moedas, medalhas e ranking da instituição
// (rank pills coloridas no padrão da referência Olympus). Certificados (spec 14.5).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Avatar, BearLoader } from "../components/common";
import { api } from "../lib/api";
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

const RANK_BG = ["#12805c", "#3949ab", "#7c3aed"];

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
      <div className="bm-achv">
        <div style={{ display: "grid", gap: "1rem", alignContent: "start", minWidth: 0 }}>
          {/* hero de moedas */}
          <section className="bm-achv-hero">
            <div style={{ fontSize: "2.4rem" }} aria-hidden>🪙</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "1.7rem", fontWeight: 750, letterSpacing: "-.02em", color: "#fff" }}>
                {coins.data?.balance ?? 0} moedas
              </div>
              <div style={{ color: "rgba(255,255,255,.85)", fontSize: ".85rem" }}>
                +{coins.data?.week ?? 0} nesta semana · moedas nascem de aprendizagem real, nunca de tempo de tela
              </div>
            </div>
          </section>

          {/* medalhas */}
          <section>
            <div className="bm-eyebrow" style={{ marginBottom: ".6rem" }}>Medalhas</div>
            <div className="bm-badges">
              {BADGES.map((b) => {
                const has = unlocked.has(b.code);
                return (
                  <div key={b.code} className="bm-card-flat" style={{ textAlign: "center", padding: ".9rem .5rem", opacity: has ? 1 : 0.5 }} title={b.hint}>
                    <div style={{ fontSize: "1.6rem", filter: has ? "none" : "grayscale(1)" }} aria-hidden>{b.icon}</div>
                    <div style={{ fontWeight: 650, fontSize: ".8rem", marginTop: ".3rem" }}>{b.label}</div>
                    <div className="bm-meta" style={{ fontSize: ".68rem", marginTop: 1 }}>{has ? "conquistada ✓" : b.hint}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* certificados */}
          <CertList childId={child.id} />

          {/* extrato */}
          {(coins.data?.ledger ?? []).length > 0 && (
            <section>
              <div className="bm-eyebrow" style={{ marginBottom: ".6rem" }}>Últimas moedas</div>
              <div className="bm-card-flat" style={{ padding: 0, overflow: "hidden" }}>
                {coins.data!.ledger.slice(0, 8).map((l, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: ".6rem 1rem", borderBottom: "1px solid var(--bm-border)", fontSize: ".88rem" }}>
                    <span>{REASON_LABEL[l.reason] ?? l.reason}</span>
                    <span style={{ fontWeight: 650, color: "var(--bm-success)" }}>+{l.delta}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ranking da instituição */}
        <aside style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          <div className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
            <div className="bm-eyebrow">Ranking da semana</div>
            <div style={{ fontWeight: 650, margin: ".25rem 0 .75rem", fontSize: ".92rem" }}>{board.data?.institution ?? "Sua instituição"}</div>
            {child.leaderboard_hidden && (
              <p className="bm-meta" style={{ marginTop: 0 }}>Seu perfil está oculto do ranking (reative em Configurações).</p>
            )}
            {(board.data?.entries ?? []).length === 0 ? (
              <p className="bm-meta" style={{ margin: 0 }}>Ninguém pontuou ainda — a primeira revisão coloca você no topo. 😉</p>
            ) : (
              <div style={{ display: "grid", gap: ".45rem" }}>
                {board.data!.entries.map((e) => (
                  <div
                    key={e.rank}
                    style={{
                      display: "flex", alignItems: "center", gap: ".6rem", padding: ".45rem .55rem",
                      borderRadius: 10, background: e.me ? "color-mix(in srgb, var(--bm-primary) 8%, transparent)" : "transparent",
                    }}
                  >
                    <span style={{
                      minWidth: 28, height: 22, borderRadius: 6, display: "grid", placeItems: "center",
                      fontSize: ".68rem", fontWeight: 700, color: "#fff",
                      background: RANK_BG[e.rank - 1] ?? "var(--bm-muted)",
                    }}>#{e.rank}</span>
                    <Avatar name={e.display_name} size={28} />
                    <span style={{ flex: 1, fontSize: ".88rem", fontWeight: e.me ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.display_name}{e.me ? " (você)" : ""}
                    </span>
                    <span style={{ fontSize: ".82rem", fontWeight: 650 }}>🪙 {e.coins}</span>
                  </div>
                ))}
              </div>
            )}
            {board.data && board.data.me.rank === null && board.data.me.coins > 0 && !child.leaderboard_hidden && (
              <p className="bm-meta" style={{ marginBottom: 0 }}>Você: 🪙 {board.data.me.coins} esta semana.</p>
            )}
          </div>
        </aside>
      </div>

      <style>{`
        .bm-achv{display:grid;gap:1rem}
        .bm-achv-hero{display:flex;align-items:center;gap:1.1rem;border-radius:var(--bm-radius);padding:1.3rem 1.4rem;
          background:linear-gradient(120deg,#283593 0%,#3949ab 55%,#5e35b1 100%);box-shadow:var(--bm-shadow)}
        .bm-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem}
        @media(min-width:920px){
          .bm-achv{grid-template-columns:minmax(0,1fr) 320px;gap:1.4rem}
          .bm-badges{grid-template-columns:repeat(6,1fr)}
        }
      `}</style>
    </AppShell>
  );
}

// Certificados conquistados (spec 14.5) — cada um leva à página pública de verificação.
function CertList({ childId }: { childId: string }) {
  const [certs, setCerts] = useState<{ code: string; issued_at: string; course_title: string; cover_emoji: string }[]>([]);
  useEffect(() => { api.certificates(childId).then((r) => setCerts(r.certificates)).catch(() => setCerts([])); }, [childId]);
  if (certs.length === 0) return null;
  return (
    <section>
      <div className="bm-eyebrow" style={{ marginBottom: ".6rem" }}>Certificados</div>
      <div style={{ display: "grid", gap: ".5rem" }}>
        {certs.map((ct) => (
          <Link key={ct.code} to={`/certificado/${ct.code}`} className="bm-card-flat" style={{ display: "flex", alignItems: "center", gap: ".8rem", padding: ".7rem .9rem", textDecoration: "none", color: "inherit" }}>
            <span style={{ fontSize: "1.5rem" }} aria-hidden>{ct.cover_emoji || "📜"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 620, fontSize: ".92rem" }}>{ct.course_title}</div>
              <div className="bm-meta">Emitido em {new Date(ct.issued_at).toLocaleDateString("pt-BR")} · verificar ↗</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
