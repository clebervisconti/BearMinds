// Gestão & automação do curso (spec 16 / P5b): boletim, relatórios, regras de
// auto-matrícula e duplicação de curso — tudo em abas sobre um só curso.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { useMe } from "../../lib/queries";
import {
  api, ApiError,
  type AdminCourseDetail, type Gradebook, type CourseReports, type EnrollmentRule,
  type CourseGroup, type StudentReadiness, type SelfAssessGapRow,
} from "../../lib/api";

type Tab = "boletim" | "relatorios" | "regras" | "duplicar" | "grupos" | "readiness" | "gap";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "boletim", label: "Boletim", icon: "📊" },
  { id: "relatorios", label: "Relatórios", icon: "📈" },
  { id: "readiness", label: "Readiness", icon: "🎯" },
  { id: "gap", label: "Autoavaliação", icon: "🪞" },
  { id: "grupos", label: "Grupos", icon: "👥" },
  { id: "regras", label: "Auto-matrícula", icon: "⚙️" },
  { id: "duplicar", label: "Duplicar", icon: "📑" },
];

export function AdminGestao() {
  const { id } = useParams();
  const nav = useNavigate();
  const [course, setCourse] = useState<AdminCourseDetail["course"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("boletim");

  useEffect(() => {
    if (!id) return;
    api.adminCourse(id)
      .then((d) => setCourse(d.course))
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Erro ao carregar curso."));
  }, [id]);

  if (!id) return null;
  if (!course && !err) return <AppShell><BearLoader label="Carregando…" /></AppShell>;

  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav(`/admin/curso/${id}`)} style={{ marginBottom: ".6rem" }}>← Curso</button>
      {err && <ErrorNote>{err}</ErrorNote>}
      {course && (
        <>
          <div className="bm-page-head" style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
            <span style={{ fontSize: "2rem" }}>{course.cover_emoji}</span>
            <div>
              <h1 style={{ fontSize: "1.3rem" }}>Gestão · {course.title}</h1>
              <div className="sub">{course.subject_id} · {course.class_id}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", margin: "1rem 0" }}>
            {TABS.map((t) => (
              <button key={t.id} className={`bm-btn-sm ${tab === t.id ? "bm-btn" : "bm-btn bm-btn-ghost"}`} onClick={() => setTab(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === "boletim" && <BoletimTab courseId={id} />}
          {tab === "relatorios" && <RelatoriosTab courseId={id} />}
          {tab === "readiness" && <ReadinessTab courseId={id} />}
          {tab === "gap" && <GapTab courseId={id} />}
          {tab === "grupos" && <GruposTab courseId={id} />}
          {tab === "regras" && <RegrasTab courseId={id} />}
          {tab === "duplicar" && <DuplicarTab courseId={id} defaultClass={course.class_id} />}
        </>
      )}
    </AppShell>
  );
}

function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) return "—";
  return `${Math.round(x * 100)}%`;
}

// ---------- Boletim (spec 16.3) ----------
function BoletimTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<Gradebook | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.adminGradebook(courseId).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, [courseId]);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <BearLoader label="Carregando boletim…" />;
  if (data.students.length === 0) return <div className="bm-card"><div className="bm-meta">Nenhum aluno matriculado ainda.</div></div>;
  if (data.activities.length === 0) return <div className="bm-card"><div className="bm-meta">Nenhuma atividade avaliativa publicada (provas ou tarefas).</div></div>;

  return (
    <div className="bm-card" style={{ overflowX: "auto", padding: ".4rem" }}>
      <table className="bm-grade-tbl">
        <thead>
          <tr>
            <th style={{ textAlign: "left", position: "sticky", left: 0 }}>Aluno</th>
            {data.activities.map((a) => (
              <th key={a.id} title={a.title}>
                <span aria-hidden>{a.kind === "exam" ? "📝" : "🗂"}</span> {a.title.length > 16 ? a.title.slice(0, 15) + "…" : a.title}
              </th>
            ))}
            <th style={{ fontWeight: 700 }}>Média</th>
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.id}>
              <td style={{ textAlign: "left", fontWeight: 600, position: "sticky", left: 0 }}>{s.display_name}<br /><span className="bm-meta">{s.grade}</span></td>
              {data.activities.map((a) => {
                const v = s.grades[a.id];
                return <td key={a.id} style={{ color: v === null || v === undefined ? "var(--bm-muted)" : "inherit" }}>{pct(v ?? null)}</td>;
              })}
              <td style={{ fontWeight: 700, color: gradeColor(s.average) }}>{pct(s.average)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bm-meta" style={{ padding: ".5rem" }}>Média = média aritmética das atividades já avaliadas. Provas usam a melhor tentativa; tarefas, a nota da rubrica.</div>
      <style>{`
        .bm-grade-tbl{border-collapse:collapse;width:100%;font-size:.85rem}
        .bm-grade-tbl th,.bm-grade-tbl td{padding:.45rem .6rem;text-align:center;white-space:nowrap;border-bottom:1px solid var(--bm-border)}
        .bm-grade-tbl th{background:var(--bm-surface-2);font-size:.75rem;color:var(--bm-muted)}
        .bm-grade-tbl thead th{position:sticky;top:0}
        .bm-grade-tbl tbody td[style*="sticky"],.bm-grade-tbl thead th[style*="sticky"]{background:var(--bm-surface)}
      `}</style>
    </div>
  );
}

function gradeColor(avg: number | null): string {
  if (avg === null) return "var(--bm-muted)";
  if (avg >= 0.6) return "var(--bm-success)";
  if (avg >= 0.4) return "var(--bm-warn)";
  return "var(--bm-danger)";
}

// ---------- Relatórios (spec 16.5) + correlação pós-prova (P5-r) ----------
function RelatoriosTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<CourseReports | null>(null);
  const [corr, setCorr] = useState<Awaited<ReturnType<typeof api.predictionCorrelation>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.adminCourseReports(courseId).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
    api.predictionCorrelation(courseId).then(setCorr).catch(() => setCorr(null));
  }, [courseId]);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <BearLoader label="Carregando relatórios…" />;

  const cards: { label: string; value: string; hint: string }[] = [
    { label: "Participação (7 dias)", value: pct(data.participation_rate), hint: `${data.active_students_7d} de ${data.total_students} alunos ativos` },
    { label: "Conclusão média", value: pct(data.average_completion), hint: "itens concluídos / itens do curso" },
    { label: "Média em provas", value: pct(data.average_exam_score), hint: "melhor tentativa por aluno" },
    { label: "Média em tarefas", value: pct(data.average_assignment_score), hint: "nota da rubrica" },
  ];
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "grid", gap: ".8rem", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        {cards.map((c) => (
          <div key={c.label} className="bm-card-flat" style={{ padding: "1rem 1.1rem" }}>
            <div className="bm-eyebrow" style={{ marginBottom: ".4rem" }}>{c.label}</div>
            <div style={{ fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-.02em" }}>{c.value}</div>
            <div className="bm-meta" style={{ marginTop: ".2rem" }}>{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="bm-card" style={{ display: "grid", gap: ".5rem" }}>
        <div className="bm-eyebrow">Correlação pós-prova: prontidão prevista × nota real</div>
        {!corr || corr.n === 0 ? (
          <div className="bm-meta">Sem provas com tentativas suficientes ainda para calcular a correlação.</div>
        ) : (
          <>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {corr.correlation === null ? "—" : corr.correlation.toFixed(2)}
              <span className="bm-meta" style={{ fontWeight: 400, fontSize: ".8rem", marginLeft: ".5rem" }}>
                (Pearson, {corr.n} tentativa{corr.n === 1 ? "" : "s"})
              </span>
            </div>
            <div className="bm-meta">{corr.note}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Readiness 2.0 (spec 17.4) ----------
function ReadinessTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<{ students: StudentReadiness[]; course_average: number | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.courseReadiness(courseId).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, [courseId]);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <BearLoader label="Carregando readiness…" />;
  if (data.students.length === 0) return <div className="bm-card"><div className="bm-meta">Nenhum aluno matriculado ainda.</div></div>;

  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <div className="bm-card-flat" style={{ padding: ".8rem 1rem", fontSize: ".85rem", color: "var(--bm-muted)" }}>
        Prontidão = rollup ponderado de <b>conhecimento</b> (FSRS, 40%), <b>habilidade</b> (rubricas de tarefas, 30%) e
        <b> execução</b> (notas de provas, 30%). Dimensões sem dado redistribuem o peso entre as demais.
        {data.course_average !== null && <> Média da turma: <b>{pct(data.course_average)}</b>.</>}
      </div>
      <div style={{ display: "grid", gap: ".5rem" }}>
        {data.students.map((s) => (
          <div key={s.id} className="bm-row">
            <span className="thumb" style={{ background: `color-mix(in srgb, ${gradeColor(s.overall)} 12%, transparent)` }}>🎯</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 620 }}>{s.display_name}</div>
              <div className="bm-meta">conhecimento {pct(s.knowledge)} · habilidade {pct(s.skill)} · execução {pct(s.execution)}</div>
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.1rem", color: gradeColor(s.overall) }}>{pct(s.overall)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Autoavaliação vs professor (spec 17.3) ----------
function GapTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<{ submissions: SelfAssessGapRow[]; average_gap: number | null; pending_teacher_review: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.selfAssessmentGap(courseId).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, [courseId]);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <BearLoader label="Carregando…" />;
  if (data.submissions.length === 0) return <div className="bm-card"><div className="bm-meta">Nenhuma autoavaliação com nota do professor ainda para comparar.</div></div>;

  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <div className="bm-card-flat" style={{ padding: ".8rem 1rem", fontSize: ".85rem", color: "var(--bm-muted)" }}>
        Gap = autoavaliação − nota do professor. Positivo = aluno superestimou; negativo = subestimou.
        {data.average_gap !== null && <> Gap médio da turma: <b>{data.average_gap >= 0 ? "+" : ""}{Math.round(data.average_gap * 100)}pp</b>.</>}
        {data.pending_teacher_review > 0 && <> {data.pending_teacher_review} autoavaliação(ões) aguardando a nota do professor.</>}
      </div>
      <div style={{ display: "grid", gap: ".5rem" }}>
        {data.submissions.map((r) => (
          <div key={r.submission_id} className="bm-row">
            <span className="thumb" style={{ background: "color-mix(in srgb, var(--bm-primary) 10%, transparent)" }}>🪞</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 620 }}>{r.student}</div>
              <div className="bm-meta">{r.item_title} · aluno {pct(r.self_fraction)} vs professor {pct(r.teacher_fraction)}</div>
            </div>
            <span style={{ fontWeight: 700, color: Math.abs(r.gap) > 0.2 ? "var(--bm-warn)" : "var(--bm-success)" }}>
              {r.gap >= 0 ? "+" : ""}{Math.round(r.gap * 100)}pp
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Grupos dentro do curso (spec 16.6) ----------
function GruposTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<{ groups: CourseGroup[]; unassigned: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.courseGroups(courseId).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setBusy(true); setErr(null);
    try { await api.createCourseGroup(courseId, title.trim()); setTitle(""); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao criar grupo."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Excluir este grupo? Os alunos permanecem matriculados no curso.")) return;
    try { await api.deleteCourseGroup(id); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="bm-card-flat" style={{ padding: ".8rem 1rem", fontSize: ".88rem", color: "var(--bm-muted)" }}>
        Turmas paralelas compartilhando o mesmo conteúdo — útil para separar leaderboard, boletim e relatórios por turma dentro de um só curso.
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="bm-card" style={{ display: "flex", gap: ".6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: ".2rem" }}>
          <span className="bm-meta">Nome do grupo</span>
          <input className="bm-input" placeholder="ex.: Turma A" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} style={{ width: 220 }} />
        </label>
        <button className="bm-btn bm-btn-sm" disabled={busy || title.trim().length < 2} onClick={create}>+ Criar grupo</button>
      </div>
      {!data ? <BearLoader label="Carregando grupos…" /> : data.groups.length === 0 ? (
        <div className="bm-card"><div className="bm-meta">Nenhum grupo ainda. Todos os {data.unassigned} aluno(s) matriculado(s) aparecem sem grupo.</div></div>
      ) : (
        <div style={{ display: "grid", gap: ".5rem" }}>
          {data.groups.map((g) => (
            <div key={g.id} className="bm-row">
              <span className="thumb" style={{ background: "color-mix(in srgb, var(--bm-primary) 10%, transparent)" }}>👥</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 620 }}>{g.title}</div>
                <div className="bm-meta">{g.members} aluno(s)</div>
              </div>
              <button className="bm-btn-quiet bm-btn-sm" onClick={() => remove(g.id)} aria-label="Excluir">🗑</button>
            </div>
          ))}
          {data.unassigned > 0 && <div className="bm-meta">{data.unassigned} aluno(s) matriculado(s) ainda sem grupo.</div>}
        </div>
      )}
    </div>
  );
}

// ---------- Regras de auto-matrícula (spec 16.1) ----------
function RegrasTab({ courseId }: { courseId: string }) {
  const me = useMe();
  const canManage = me.data?.parent.role === "institution_admin" || me.data?.parent.role === "platform_admin";
  const [rules, setRules] = useState<EnrollmentRule[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.adminEnrollmentRules(courseId).then((r) => setRules(r.rules)).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setBusy(true); setErr(null);
    try {
      await api.adminCreateEnrollmentRule(courseId, { grade: grade.trim() || null, class_id: classId.trim() || null });
      setGrade(""); setClassId("");
      load();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao criar regra."); }
    finally { setBusy(false); }
  }

  async function remove(ruleId: string) {
    if (!confirm("Remover esta regra? Alunos já matriculados permanecem.")) return;
    try { await api.adminDeleteEnrollmentRule(ruleId); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="bm-card-flat" style={{ padding: ".8rem 1rem", fontSize: ".88rem", color: "var(--bm-muted)" }}>
        Alunos cujo perfil casa com uma regra são matriculados automaticamente ao serem criados ou atualizados.
        Deixe um campo em branco para valer para <b>todas</b> as séries ou turmas.
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}

      {canManage && (
        <div className="bm-card" style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: ".2rem" }}>
            <span className="bm-meta">Série (ex.: 6EF)</span>
            <input className="bm-input" placeholder="todas" value={grade} maxLength={20} onChange={(e) => setGrade(e.target.value)} style={{ width: 140 }} />
          </label>
          <label style={{ display: "grid", gap: ".2rem" }}>
            <span className="bm-meta">Turma (ex.: y5)</span>
            <input className="bm-input" placeholder="todas" value={classId} maxLength={60} onChange={(e) => setClassId(e.target.value)} style={{ width: 140 }} />
          </label>
          <button className="bm-btn bm-btn-sm" disabled={busy} onClick={create}>+ Adicionar regra</button>
        </div>
      )}

      {!rules ? <BearLoader label="Carregando regras…" /> : rules.length === 0 ? (
        <div className="bm-card"><div className="bm-meta">Nenhuma regra de auto-matrícula.{canManage ? "" : " Peça a um administrador da instituição para criar."}</div></div>
      ) : (
        <div style={{ display: "grid", gap: ".5rem" }}>
          {rules.map((r) => (
            <div key={r.id} className="bm-row">
              <span className="thumb" style={{ background: "color-mix(in srgb, var(--bm-primary) 10%, transparent)" }}>⚙️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Série: {r.grade ?? "todas"} · Turma: {r.class_id ?? "todas"}</div>
                <div className="bm-meta">criada em {new Date(r.created_at).toLocaleDateString("pt-BR")}</div>
              </div>
              {canManage && <button className="bm-btn-quiet bm-btn-sm" onClick={() => remove(r.id)} aria-label="Remover">🗑</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Duplicação (spec 16.2) ----------
function DuplicarTab({ courseId, defaultClass }: { courseId: string; defaultClass: string }) {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(defaultClass);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true); setErr(null);
    try {
      const r = await api.adminDuplicateCourse(courseId, { title: title.trim(), class_id: classId.trim() });
      nav(`/admin/curso/${r.id}`);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao duplicar curso."); setBusy(false); }
  }

  const disabled = busy || title.trim().length < 2 || classId.trim().length < 1;
  return (
    <div className="bm-card" style={{ display: "grid", gap: ".7rem", maxWidth: 480 }}>
      <div className="bm-meta">
        Clona a estrutura completa (módulos, itens, regras de disponibilidade) em um <b>novo curso em rascunho</b>.
        Nenhum aluno é matriculado. Use para um novo período letivo ou outra turma.
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <label style={{ display: "grid", gap: ".25rem" }}>
        <span className="bm-meta">Título do novo curso</span>
        <input className="bm-input" placeholder="ex.: Frações — 2026 · Turma B" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: ".25rem" }}>
        <span className="bm-meta">Turma (class_id)</span>
        <input className="bm-input" value={classId} maxLength={60} onChange={(e) => setClassId(e.target.value)} />
      </label>
      <button className="bm-btn" disabled={disabled} onClick={duplicate} style={{ justifySelf: "start" }}>
        {busy ? "Duplicando…" : "📑 Duplicar curso"}
      </button>
    </div>
  );
}
