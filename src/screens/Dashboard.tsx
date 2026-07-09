// Dashboard (spec 12.2) — layout de referência MIT/Olympus: coluna principal
// ("Continuar aprendendo", atividades) + trilho direito (programa, números, prontidão).
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BearLoader, Progress } from "../components/common";
import { useMe, useToday, useCoins, useParentSummary, useInstitutions, useTimeline, useMyGrades, activeChild } from "../lib/queries";
import type { TimelineItem, GradeCourse } from "../lib/api";

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
  const insts = useInstitutions();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const today = useToday(child?.id ?? null);
  const coins = useCoins(child?.id ?? null);
  const summary = useParentSummary(child?.id ?? null);
  const timeline = useTimeline(child?.id ?? null);
  const grades = useMyGrades(child?.id ?? null);

  if (me.isLoading || (child && today.isLoading)) {
    return <AppShell><BearLoader label="Carregando…" /></AppShell>;
  }
  if (!child) return null;

  const reviews = today.data?.reviews ?? [];
  const provas = today.data?.provas ?? [];
  const streak = today.data?.streak ?? 0;
  const week = summary.data?.week;
  const mastery = summary.data?.mastery_by_subject ?? [];
  const remembered = mastery.reduce((a, m) => a + m.remembered, 0);
  const reviewing = mastery.reduce((a, m) => a + m.reviewing, 0);
  const badges = coins.data?.achievements ?? [];
  const institution = insts.data?.institutions.find((i) => i.id === (child.institution_id ?? "bncc-padrao"));
  const className = institution?.classes.find((c) => c.id === (child.class_id ?? child.grade))?.label ?? child.grade;
  const prioritySubject = institution?.subjects.find((s) => s.id === (child.priority_subject ?? child.subjects[0]));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppShell>
      <div className="bm-page-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: ".8rem" }}>
        <div>
          <h1>{greeting}, {child.display_name}</h1>
          <div className="sub">
            {reviews.length > 0
              ? `${reviews.length} ${reviews.length === 1 ? "revisão programada" : "revisões programadas"} para hoje — o momento certo fixa a memória.`
              : "Nenhuma revisão pendente. Bom momento para avançar em um curso."}
          </div>
        </div>
        <div style={{ display: "flex", gap: ".5rem" }}>
          {streak > 0 && <span className="bm-chip bm-chip-outline">🔥 {streak} {streak === 1 ? "dia" : "dias"}</span>}
          <span className="bm-chip bm-chip-outline">🪙 {coins.data?.week ?? 0} na semana</span>
        </div>
      </div>

      <div className="bm-dash">
        {/* ================= coluna principal ================= */}
        <div className="bm-dash-main">
          <section>
            <div className="bm-eyebrow" style={{ marginBottom: ".6rem" }}>Continuar aprendendo</div>
            <div style={{ display: "grid", gap: ".6rem" }}>
              {reviews.length > 0 && (
                <div className="bm-row">
                  <span className="thumb" style={{ background: "color-mix(in srgb, var(--bm-warn) 12%, transparent)" }}>⏱</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 620 }}>Revisões do dia</div>
                    <div className="bm-meta">{reviews.length} {reviews.length === 1 ? "item curto" : "itens curtos"} · ~{Math.max(2, reviews.length)} min</div>
                  </div>
                  <button className="bm-btn bm-btn-sm" onClick={() => nav("/atividades?revisar=1")}>Retomar</button>
                </div>
              )}
              <div className="bm-row">
                <span className="thumb" style={{ background: "color-mix(in srgb, var(--bm-primary) 10%, transparent)" }}>{prioritySubject?.icon ?? "▤"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 620 }}>{prioritySubject?.label ?? "Meus cursos"}</div>
                  <div className="bm-meta">{remembered > 0 ? `${remembered} conceitos dominados · continue de onde parou` : "Comece pelo primeiro tópico do curso"}</div>
                </div>
                <button className="bm-btn bm-btn-sm bm-btn-ghost" onClick={() => nav("/cursos")}>{remembered > 0 ? "Continuar" : "Começar"}</button>
              </div>
            </div>
          </section>

          <section>
            <div className="bm-eyebrow" style={{ margin: "1.4rem 0 .6rem" }}>Próximas atividades {provas.length > 0 && `(${provas.length})`}</div>
            {provas.length === 0 ? (
              <div className="bm-card-flat" style={{ padding: "1rem 1.1rem", color: "var(--bm-muted)", fontSize: ".9rem" }}>
                Nenhuma prova agendada. <Link to="/atividades">Cadastrar uma prova</Link> organiza as revisões para a data certa.
              </div>
            ) : (
              <div style={{ display: "grid", gap: ".6rem" }}>
                {provas.map((p) => (
                  <button key={p.id} className="bm-row" onClick={() => nav("/atividades")}>
                    <span className="thumb" style={{ background: "color-mix(in srgb, var(--bm-danger) 8%, transparent)" }}>📅</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 620 }}>{p.title}</div>
                      <div className="bm-meta">
                        {new Date(p.exam_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ·{" "}
                        {p.days_left === 0 ? "hoje" : `em ${p.days_left} dia${p.days_left === 1 ? "" : "s"}`} · prontidão {Math.round(p.readiness * 100)}%
                      </div>
                      <div style={{ marginTop: ".4rem", maxWidth: 320 }}><Progress value={p.readiness} /></div>
                    </div>
                    <span style={{ color: "var(--bm-muted)" }}>›</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: ".9rem" }}>
              <Link to="/atividades" style={{ fontSize: ".88rem", fontWeight: 600, textDecoration: "none" }}>Ver todas as atividades →</Link>
            </div>
          </section>

          <TimelineSection items={timeline.data?.timeline ?? []} onOpenExam={(examId) => nav(`/prova/${examId}`)} onOpenCourse={(cid) => nav(`/curso/${cid}`)} />
        </div>

        {/* ================= trilho direito ================= */}
        <aside className="bm-dash-rail">
          <div className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
            <div style={{ fontWeight: 650 }}>{institution?.name ?? "Escola brasileira (BNCC)"}</div>
            <div className="bm-meta" style={{ marginTop: 2 }}>{className} · {child.subjects.length} {child.subjects.length === 1 ? "disciplina" : "disciplinas"}</div>

            <div className="bm-statgrid">
              <div><div className="v" style={{ color: "var(--bm-success)" }}>{remembered}</div><div className="k">dominados</div></div>
              <div><div className="v" style={{ color: "var(--bm-link)" }}>{reviewing}</div><div className="k">em revisão</div></div>
              <div><div className="v" style={{ color: "var(--bm-warn)" }}>{reviews.length}</div><div className="k">para hoje</div></div>
            </div>

            <hr className="bm-divider" />
            <Link to="/conquistas" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit", padding: ".2rem 0" }}>
              <span style={{ fontSize: ".9rem", fontWeight: 550 }}>📈 Minha evolução</span>
              <span style={{ color: "var(--bm-muted)" }}>›</span>
            </Link>
            <Link to="/atividades" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit", padding: ".2rem 0" }}>
              <span style={{ fontSize: ".9rem", fontWeight: 550 }}>🗓 Provas e revisões</span>
              <span style={{ color: "var(--bm-muted)" }}>›</span>
            </Link>
          </div>

          <div className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
            <div className="bm-eyebrow" style={{ marginBottom: ".5rem" }}>Sua semana</div>
            <WeekBars activeDays={week?.active_days ?? 0} />
            <div className="bm-meta" style={{ marginTop: ".5rem" }}>
              {week ? `${week.active_days} de 7 dias ativos · ${week.reviews} revisões` : "—"}
            </div>
          </div>

          <GradesCard courses={grades.data?.courses ?? []} />

          {badges.length > 0 && (
            <div className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
              <div className="bm-eyebrow" style={{ marginBottom: ".55rem" }}>Conquistas recentes</div>
              <div style={{ display: "grid", gap: ".45rem" }}>
                {badges.slice(0, 3).map((b) => (
                  <div key={b.code} style={{ display: "flex", alignItems: "center", gap: ".55rem", fontSize: ".88rem" }}>
                    <span aria-hidden>🏅</span> {BADGE_LABEL[b.code] ?? b.code}
                  </div>
                ))}
              </div>
              <Link to="/conquistas" style={{ fontSize: ".82rem", fontWeight: 600, textDecoration: "none", display: "inline-block", marginTop: ".6rem" }}>Ver todas →</Link>
            </div>
          )}
        </aside>
      </div>

      <style>{`
        .bm-dash{display:grid;gap:1rem}
        .bm-dash-rail{display:grid;gap:1rem;align-content:start}
        .bm-statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:1rem;text-align:center}
        .bm-statgrid .v{font-size:1.35rem;font-weight:700;letter-spacing:-.02em}
        .bm-statgrid .k{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--bm-muted);margin-top:2px}
        @media(min-width:920px){.bm-dash{grid-template-columns:minmax(0,1fr) 320px;gap:1.4rem}}
      `}</style>
    </AppShell>
  );
}

// Cronograma / prazos (spec 16.4) — tarefas e provas com due_at, já filtradas no backend.
function TimelineSection({ items, onOpenExam, onOpenCourse }: {
  items: TimelineItem[]; onOpenExam: (examId: string) => void; onOpenCourse: (courseId: string) => void;
}) {
  if (items.length === 0) return null;
  const now = Date.now();
  return (
    <section>
      <div className="bm-eyebrow" style={{ margin: "1.4rem 0 .6rem" }}>O que vence em seguida ({items.length})</div>
      <div style={{ display: "grid", gap: ".6rem" }}>
        {items.slice(0, 6).map((it) => {
          const due = new Date(it.due_at);
          const daysLeft = Math.ceil((due.getTime() - now) / 86400000);
          const overdue = daysLeft < 0;
          const clickable = it.available;
          const go = () => it.kind === "exam" ? onOpenExam(it.id) : onOpenCourse(it.course_id);
          return (
            <button
              key={`${it.kind}-${it.id}`}
              className="bm-row"
              onClick={clickable ? go : undefined}
              style={{ opacity: clickable ? 1 : 0.7, cursor: clickable ? "pointer" : "default" }}
            >
              <span className="thumb" style={{ background: `color-mix(in srgb, var(--bm-${overdue ? "danger" : it.kind === "exam" ? "warn" : "primary"}) 10%, transparent)` }}>
                {clickable ? (it.kind === "exam" ? "📝" : "🗂") : "🔒"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 620 }}>{it.title}</div>
                <div className="bm-meta">
                  {it.course_title} · {it.kind === "exam" ? "prova" : "tarefa"} ·{" "}
                  {overdue
                    ? `venceu ${due.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
                    : daysLeft === 0 ? "vence hoje" : `em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`}
                  {!it.available && it.lock_reason ? ` · 🔒 ${it.lock_reason}` : ""}
                </div>
              </div>
              {clickable && <span style={{ color: "var(--bm-muted)" }}>›</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Boletim resumido (spec 16.3) — média por curso, visão do estudante.
function GradesCard({ courses }: { courses: GradeCourse[] }) {
  const graded = courses.filter((c) => c.average !== null);
  if (graded.length === 0) return null;
  return (
    <div className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
      <div className="bm-eyebrow" style={{ marginBottom: ".55rem" }}>Boletim</div>
      <div style={{ display: "grid", gap: ".5rem" }}>
        {graded.map((c) => {
          const avg = c.average ?? 0;
          const color = avg >= 0.6 ? "var(--bm-success)" : avg >= 0.4 ? "var(--bm-warn)" : "var(--bm-danger)";
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: ".55rem", fontSize: ".88rem" }}>
              <span aria-hidden>{c.cover_emoji}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
              <span style={{ fontWeight: 700, color }}>{Math.round(avg * 100)}%</span>
            </div>
          );
        })}
      </div>
      <div className="bm-meta" style={{ marginTop: ".5rem" }}>Média das provas e tarefas já avaliadas.</div>
    </div>
  );
}

// Barras da semana (seg→dom) — visual leve, sem lib.
function WeekBars({ activeDays }: { activeDays: number }) {
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=seg
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 46 }}>
      {days.map((d, i) => {
        const active = i >= Math.max(0, todayIdx - activeDays + 1) && i <= todayIdx && activeDays > 0;
        return (
          <div key={i} style={{ flex: 1, display: "grid", gap: 3, justifyItems: "center" }}>
            <div style={{
              width: "100%", borderRadius: 4,
              height: active ? 30 : 12,
              background: active ? "var(--bm-primary)" : "var(--bm-surface-2)",
              outline: i === todayIdx ? "2px solid color-mix(in srgb, var(--bm-primary) 30%, transparent)" : "none",
            }} />
            <span style={{ fontSize: ".6rem", color: "var(--bm-muted)" }}>{d}</span>
          </div>
        );
      })}
    </div>
  );
}
