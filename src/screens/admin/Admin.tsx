// Administração — visão geral + cursos (spec 13). Staff apenas (guardião nunca vê).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError, type AdminCourse } from "../../lib/api";
import { useMe, useInstitutions } from "../../lib/queries";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: "rascunho", color: "var(--bm-muted)" },
  published: { label: "publicado", color: "var(--bm-success)" },
  archived: { label: "arquivado", color: "var(--bm-warn)" },
};

export function Admin() {
  const nav = useNavigate();
  const me = useMe();
  const insts = useInstitutions();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.adminOverview>> | null>(null);
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const role = me.data?.parent.role ?? "guardian";
  const myInst = me.data?.parent.staff_institution_id ?? null;

  async function load() {
    try {
      const [o, cs] = await Promise.all([api.adminOverview(), api.adminCourses()]);
      setOverview(o);
      setCourses(cs.courses);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao carregar.");
    }
  }
  useEffect(() => {
    if (role !== "guardian") void load();
  }, [role]);

  if (me.isLoading) return <AppShell title="Administração"><BearLoader label="Carregando…" /></AppShell>;
  if (role === "guardian") {
    return (
      <AppShell title="Administração">
        <ErrorNote>Área restrita à equipe (professores e gestores).</ErrorNote>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="bm-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: ".8rem" }}>
        <div>
          <h1>Administração</h1>
          <div className="sub">
            {role === "platform_admin" ? "Administrador da plataforma" : role === "institution_admin" ? "Gestor da instituição" : role === "professor" ? "Professor" : "Tutor"}
            {overview?.institution_id ? ` · ${overview.institution_id}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav("/admin/coaching")}>🎯 Coaching</button>
          {(role === "institution_admin" || role === "platform_admin") && (
            <>
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav("/admin/moderacao")}>🛡 Moderação</button>
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav("/admin/pessoas")}>👥 Pessoas & convites</button>
            </>
          )}
          <button className="bm-btn bm-btn-sm" onClick={() => setCreating((v) => !v)}>{creating ? "Fechar" : "+ Novo curso"}</button>
        </div>
      </div>

      {err && <ErrorNote>{err}</ErrorNote>}

      {overview && (
        <div className="bm-adm-stats">
          <Stat label="cursos" value={overview.courses} />
          <Stat label="publicados" value={overview.published} color="var(--bm-success)" />
          <Stat label="estudantes" value={overview.students} color="var(--bm-primary)" />
          <Stat label="aguardando revisão" value={overview.pending_review} color="var(--bm-warn)" />
        </div>
      )}

      {creating && (
        <CreateCourse
          defaultInstitution={myInst ?? "bncc-padrao"}
          canPickInstitution={role === "platform_admin"}
          institutions={insts.data?.institutions ?? []}
          onCreated={(id) => nav(`/admin/curso/${id}`)}
        />
      )}

      <div className="bm-eyebrow" style={{ margin: "1.3rem 0 .6rem" }}>Cursos</div>
      {!courses ? (
        <BearLoader label="Carregando cursos…" />
      ) : courses.length === 0 ? (
        <div className="bm-card" style={{ color: "var(--bm-muted)", textAlign: "center", padding: "2rem" }}>
          Nenhum curso ainda. Crie o primeiro — o pipeline de IA transforma seu material em módulos gamificados.
        </div>
      ) : (
        <div style={{ display: "grid", gap: ".6rem" }}>
          {courses.map((cs) => {
            const st = STATUS_LABEL[cs.status] ?? STATUS_LABEL.draft;
            return (
              <button key={cs.id} className="bm-row" onClick={() => nav(`/admin/curso/${cs.id}`)}>
                <span className="thumb">{cs.cover_emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 620 }}>{cs.title}</div>
                  <div className="bm-meta">
                    {cs.subject_id} · {cs.class_id}{cs.term ? ` · ${cs.term}` : ""}{cs.year ? ` · ${cs.year}` : ""} · {cs.modules} módulos · {cs.enrolled} matrículas
                  </div>
                </div>
                <span className="bm-chip bm-chip-outline" style={{ color: st.color }}>{st.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        .bm-adm-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;margin-bottom:1rem}
        @media(min-width:920px){.bm-adm-stats{grid-template-columns:repeat(4,1fr)}}
      `}</style>
    </AppShell>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bm-card-flat" style={{ padding: ".8rem 1rem", textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 750, color: color ?? "var(--bm-ink)" }}>{value}</div>
      <div className="bm-eyebrow">{label}</div>
    </div>
  );
}

function CreateCourse({ defaultInstitution, canPickInstitution, institutions, onCreated }: {
  defaultInstitution: string;
  canPickInstitution: boolean;
  institutions: { id: string; name: string; classes: { id: string; label: string }[]; subjects: { id: string; label: string; icon: string }[]; terms: string[] }[];
  onCreated: (id: string) => void;
}) {
  const [instId, setInstId] = useState(defaultInstitution);
  const inst = institutions.find((i) => i.id === instId);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [klass, setKlass] = useState("");
  const [term, setTerm] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [emoji, setEmoji] = useState("📘");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.adminCreateCourse({
        institution_id: instId, subject_id: subject, class_id: klass,
        term: term || null, year, title: title.trim(), cover_emoji: emoji,
      });
      onCreated(r.id);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao criar curso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bm-card" style={{ display: "grid", gap: ".6rem", marginBottom: "1rem" }}>
      <div className="bm-eyebrow">Novo curso</div>
      {canPickInstitution && (
        <label>Instituição
          <select className="bm-input" value={instId} onChange={(e) => { setInstId(e.target.value); setSubject(""); setKlass(""); }}>
            {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
      )}
      <label>Título<input className="bm-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Matemática — Frações e Decimais" /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
        <label>Disciplina
          <select className="bm-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">—</option>
            {inst?.subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
          </select>
        </label>
        <label>Turma/Série
          <select className="bm-input" value={klass} onChange={(e) => setKlass(e.target.value)}>
            <option value="">—</option>
            {inst?.classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.label}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: ".6rem" }}>
        <label>Período
          <select className="bm-input" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">anual</option>
            {(inst?.terms ?? ["t1", "t2", "t3"]).map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="s1">s1</option>
            <option value="s2">s2</option>
          </select>
        </label>
        <label>Ano letivo<input className="bm-input" type="number" value={year} min={2024} max={2100} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label>Capa<input className="bm-input" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} /></label>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <button className="bm-btn" disabled={busy || !title.trim() || !subject || !klass} onClick={save} style={{ justifySelf: "start" }}>
        {busy ? "Criando…" : "Criar curso"}
      </button>
    </div>
  );
}
