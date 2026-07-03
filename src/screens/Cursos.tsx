// Cursos (spec 12.2) — cards por disciplina com progresso de maestria → tópicos do curso.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote } from "../components/common";
import { api, ApiError } from "../lib/api";
import { useMe, useInstitutions, useTree, useParentSummary, activeChild } from "../lib/queries";
import type { TopicCandidate } from "../../shared/contracts";

export function Cursos() {
  const nav = useNavigate();
  const me = useMe();
  const insts = useInstitutions();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const summary = useParentSummary(child?.id ?? null);
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  const institutionId = child?.institution_id ?? "bncc-padrao";
  const institution = insts.data?.institutions.find((i) => i.id === institutionId);
  const classId = child?.class_id ?? child?.grade ?? "";
  const tree = useTree(openSubject ? { institution: institutionId, class: classId, subject: openSubject } : null);

  if (me.isLoading || insts.isLoading) {
    return <AppShell title="Cursos"><BearLoader label="Carregando…" /></AppShell>;
  }
  if (!child || !institution) return null;

  const enrolled = child.subjects;
  const mastery = new Map((summary.data?.mastery_by_subject ?? []).map((m) => [m.subject_id, m]));
  const subjLang = (id: string) => institution.subjects.find((s) => s.id === id)?.lang ?? "pt";

  // -------- visão do curso aberto (tópicos) --------
  if (openSubject) {
    const subj = institution.subjects.find((s) => s.id === openSubject);
    return (
      <AppShell title={`${subj?.icon ?? ""} ${subj?.label ?? openSubject}`}>
        <button className="bm-btn bm-btn-ghost" onClick={() => setOpenSubject(null)} style={{ marginBottom: "1rem" }}>
          ← Todos os cursos
        </button>
        {tree.isLoading && <BearLoader label="Carregando tópicos…" />}
        {tree.data && tree.data.topics.length === 0 && (
          <p style={{ color: "var(--bm-muted)" }}>Conteúdo verificado em preparação para esta disciplina/turma.</p>
        )}
        <div style={{ display: "grid", gap: ".55rem" }}>
          {tree.data?.topics.map((t) => (
            <button
              key={t.bncc_code}
              className="bm-card"
              onClick={() => nav(`/aula?code=${encodeURIComponent(t.bncc_code)}&lang=${subjLang(openSubject)}`)}
              style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ color: "var(--bm-muted)", fontSize: ".82rem" }}>{t.atom_count} conceitos · {t.bncc_code}</div>
              </div>
              <span style={{ fontSize: ".78rem", color: t.has_cache ? "var(--bm-success)" : "var(--bm-muted)", whiteSpace: "nowrap" }}>
                {t.has_cache ? "disponível ⚡" : "gerar (~15 s)"}
              </span>
            </button>
          ))}
        </div>
      </AppShell>
    );
  }

  // -------- grade de cursos --------
  return (
    <AppShell title="Meus cursos">
      <TopicSearch grade={child.grade} onGo={(code) => nav(`/aula?code=${encodeURIComponent(code)}&lang=pt`)} />
      <div className="bm-course-grid">
        {institution.subjects.map((s) => {
          const isEnrolled = enrolled.includes(s.id);
          const m = mastery.get(s.id);
          const pct = m && m.total > 0 ? m.remembered / m.total : 0;
          return (
            <button
              key={s.id}
              className="bm-card bm-course"
              disabled={!isEnrolled}
              onClick={() => setOpenSubject(s.id)}
              style={{ opacity: isEnrolled ? 1 : 0.55, cursor: isEnrolled ? "pointer" : "default", textAlign: "left" }}
            >
              <div className="bm-course-ring" style={{ ["--p" as string]: `${Math.round(pct * 360)}deg` }}>
                <span>{s.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 650 }}>{s.label}</div>
                <div style={{ color: "var(--bm-muted)", fontSize: ".82rem" }}>
                  {isEnrolled
                    ? m && m.total > 0
                      ? `${m.remembered} de ${m.total} conceitos dominados`
                      : "Comece pelo primeiro tópico"
                    : "em breve"}
                </div>
              </div>
              {isEnrolled && <span style={{ color: "var(--bm-primary)", fontWeight: 700 }}>→</span>}
            </button>
          );
        })}
      </div>
      <style>{`
        .bm-course-grid{display:grid;gap:.8rem}
        @media(min-width:900px){.bm-course-grid{grid-template-columns:1fr 1fr}}
        .bm-course{display:flex;align-items:center;gap:.9rem;border:1px solid var(--bm-border)}
        .bm-course-ring{width:52px;height:52px;border-radius:999px;display:grid;place-items:center;font-size:1.35rem;
          background:conic-gradient(var(--bm-accent) var(--p,0deg), var(--bm-surface-2) 0deg)}
        .bm-course-ring span{background:var(--bm-surface);width:42px;height:42px;border-radius:999px;display:grid;place-items:center}
      `}</style>
    </AppShell>
  );
}

// Busca livre de tópico ("frações equivalentes") → resolve para BNCC (spec 04 §4.3).
function TopicSearch({ grade, onGo }: { grade: string; onGo: (code: string) => void }) {
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<TopicCandidate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setErr(null);
    setBusy(true);
    setCandidates(null);
    try {
      const res = await api.resolveTopic(q.trim(), grade);
      if (res.candidates.length === 0) setErr("Tópico ainda fora do nosso material verificado. Tente outro.");
      else if (res.candidates.length === 1) onGo(res.candidates[0].bncc_code);
      else setCandidates(res.candidates);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro na busca.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bm-card" style={{ marginBottom: "1rem", display: "grid", gap: ".5rem" }}>
      <div style={{ display: "flex", gap: ".5rem" }}>
        <input
          className="bm-input"
          placeholder="Estudar um tópico específico — ex.: frações equivalentes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button className="bm-btn" onClick={search} disabled={busy || !q.trim()}>{busy ? "…" : "Buscar"}</button>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      {candidates && (
        <div style={{ display: "grid", gap: ".4rem" }}>
          <span style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>É isso que você quer estudar?</span>
          {candidates.map((c) => (
            <button key={c.bncc_code} className="bm-btn bm-btn-ghost" style={{ justifyContent: "flex-start" }} onClick={() => onGo(c.bncc_code)}>
              {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
