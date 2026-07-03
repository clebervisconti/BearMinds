// Dashboard (spec 12.2) — visão Moodle-like: revisões de hoje, timeline de provas,
// atividade da semana, streak/moedas, últimas conquistas.
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BearLoader, Progress } from "../components/common";
import { useMe, useToday, useCoins, useParentSummary, activeChild } from "../lib/queries";

const BADGE_LABEL: Record<string, string> = {
  first_lesson: "Primeira missão",
  streak_7: "7 dias seguidos",
  streak_30: "30 dias seguidos",
  atoms_10: "10 conceitos",
  atoms_50: "50 conceitos",
  prova_ready_80: "80% pronto",
};

export function Dashboard() {
  const nav = useNavigate();
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const today = useToday(child?.id ?? null);
  const coins = useCoins(child?.id ?? null);
  const summary = useParentSummary(child?.id ?? null);

  if (me.isLoading || (child && today.isLoading)) {
    return (
      <AppShell>
        <BearLoader label="Carregando…" />
      </AppShell>
    );
  }
  if (!child) return null;

  const reviews = today.data?.reviews ?? [];
  const provas = today.data?.provas ?? [];
  const streak = today.data?.streak ?? 0;
  const week = summary.data?.week;
  const badges = coins.data?.achievements ?? [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppShell>
      <div style={{ display: "grid", gap: "1.1rem" }}>
        {/* saudação + chips */}
        <section style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: ".8rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.45rem" }}>
              {greeting}, {child.display_name}
            </h1>
            <p style={{ margin: ".25rem 0 0", color: "var(--bm-muted)" }}>
              {reviews.length > 0
                ? `Você tem ${reviews.length} ${reviews.length === 1 ? "revisão" : "revisões"} para hoje.`
                : "Tudo em dia por aqui. Que tal avançar em um curso?"}
            </p>
          </div>
          <div style={{ display: "flex", gap: ".5rem" }}>
            {streak > 0 && <span className="bm-card" style={{ padding: ".35rem .8rem" }}>🔥 {streak} {streak === 1 ? "dia" : "dias"}</span>}
            <span className="bm-card" style={{ padding: ".35rem .8rem" }}>🪙 {coins.data?.week ?? 0} esta semana</span>
          </div>
        </section>

        <div className="bm-dash-grid">
          {/* revisões de hoje */}
          <section className="bm-card">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Para revisar hoje</h2>
            {reviews.length === 0 ? (
              <p style={{ color: "var(--bm-muted)" }}>Nenhuma revisão pendente. Consistência em dia. ✓</p>
            ) : (
              <>
                <p style={{ color: "var(--bm-muted)" }}>
                  {reviews.length} {reviews.length === 1 ? "item curto" : "itens curtos"} — leva poucos minutos e é o
                  que fixa a memória.
                </p>
                <button className="bm-btn" onClick={() => nav("/atividades?revisar=1")}>Começar revisão</button>
              </>
            )}
          </section>

          {/* timeline de provas */}
          <section className="bm-card">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Próximas provas</h2>
            {provas.length === 0 ? (
              <p style={{ color: "var(--bm-muted)" }}>
                Nenhuma prova agendada. <Link to="/atividades">Adicionar uma</Link> ajuda a organizar as revisões.
              </p>
            ) : (
              <div style={{ display: "grid", gap: ".7rem" }}>
                {provas.map((p) => (
                  <div key={p.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".92rem" }}>
                      <strong>{p.title}</strong>
                      <span style={{ color: "var(--bm-muted)" }}>
                        {p.days_left === 0 ? "hoje" : `em ${p.days_left} dia${p.days_left === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginTop: ".3rem" }}>
                      <div style={{ flex: 1 }}><Progress value={p.readiness} /></div>
                      <span style={{ fontSize: ".85rem", fontWeight: 600 }}>{Math.round(p.readiness * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* continuar estudando */}
          <section className="bm-card">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Continuar estudando</h2>
            <p style={{ color: "var(--bm-muted)" }}>Retome de onde parou ou explore um tópico novo.</p>
            <Link to="/cursos" className="bm-btn" style={{ textDecoration: "none" }}>Ir para meus cursos</Link>
          </section>

          {/* semana + conquistas */}
          <section className="bm-card">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Sua semana</h2>
            <div style={{ display: "flex", gap: "1.2rem", marginBottom: ".6rem" }}>
              <Stat label="dias ativos" value={week ? `${week.active_days}/7` : "—"} />
              <Stat label="revisões" value={week ? String(week.reviews) : "—"} />
            </div>
            {badges.length > 0 && (
              <>
                <div style={{ color: "var(--bm-muted)", fontSize: ".85rem", marginBottom: ".35rem" }}>Últimas conquistas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
                  {badges.slice(0, 3).map((b) => (
                    <span key={b.code} className="bm-card" style={{ padding: ".25rem .6rem", fontSize: ".82rem" }}>
                      🏅 {BADGE_LABEL[b.code] ?? b.code}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
      <style>{`
        .bm-dash-grid{display:grid;gap:1rem}
        @media(min-width:900px){.bm-dash-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--bm-muted)", fontSize: ".8rem" }}>{label}</div>
    </div>
  );
}
