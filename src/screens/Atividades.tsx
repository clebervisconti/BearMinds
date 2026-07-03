// Atividades (spec 12.2): fila de revisão + histórico + provas (listar/adicionar).
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote, Progress } from "../components/common";
import { QuizCard } from "../components/QuizCard";
import { api, ApiError } from "../lib/api";
import { useMe, useToday, useInstitutions, activeChild } from "../lib/queries";
import type { ReviewItem } from "../../shared/contracts";

export function Atividades() {
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const insts = useInstitutions();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const today = useToday(child?.id ?? null);
  const [reviewing, setReviewing] = useState(params.get("revisar") === "1");
  const [showProvaForm, setShowProvaForm] = useState(false);

  if (me.isLoading || (child && today.isLoading)) {
    return <AppShell title="Atividades"><BearLoader label="Carregando…" /></AppShell>;
  }
  if (!child) return null;

  const reviews = today.data?.reviews ?? [];
  const provas = today.data?.provas ?? [];

  if (reviewing && reviews.length > 0) {
    return (
      <AppShell title="Sessão de revisão">
        <ReviewSession
          reviews={reviews}
          childId={child.id}
          onDone={() => {
            setReviewing(false);
            setParams({});
            today.refetch();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Atividades">
      <div style={{ display: "grid", gap: "1.1rem" }}>
        <section className="bm-card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Fila de revisão</h2>
          {reviews.length === 0 ? (
            <p style={{ color: "var(--bm-muted)" }}>Nada pendente — sua memória está em dia. ✓</p>
          ) : (
            <>
              <p style={{ color: "var(--bm-muted)" }}>
                {reviews.length} {reviews.length === 1 ? "item" : "itens"} no momento ideal de revisão.
              </p>
              <button className="bm-btn" onClick={() => setReviewing(true)}>Começar agora</button>
            </>
          )}
        </section>

        <section className="bm-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Provas</h2>
            <button className="bm-btn bm-btn-ghost" onClick={() => setShowProvaForm((v) => !v)}>
              {showProvaForm ? "Fechar" : "+ Adicionar prova"}
            </button>
          </div>
          {provas.length === 0 && !showProvaForm && (
            <p style={{ color: "var(--bm-muted)", marginBottom: 0 }}>
              Cadastre a próxima prova e as revisões passam a mirar a data certa.
            </p>
          )}
          <div style={{ display: "grid", gap: ".7rem", marginTop: ".7rem" }}>
            {provas.map((p) => (
              <div key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".92rem" }}>
                  <strong>{p.title}</strong>
                  <span style={{ color: "var(--bm-muted)" }}>
                    {p.exam_date} · {p.days_left === 0 ? "hoje" : `${p.days_left}d`}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginTop: ".3rem" }}>
                  <div style={{ flex: 1 }}><Progress value={p.readiness} /></div>
                  <span style={{ fontSize: ".85rem", fontWeight: 600 }}>{Math.round(p.readiness * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
          {showProvaForm && (
            <ProvaForm
              childId={child.id}
              institutionId={child.institution_id ?? "bncc-padrao"}
              classId={child.class_id ?? child.grade}
              subjects={child.subjects}
              subjectLabel={(id) =>
                insts.data?.institutions
                  .find((i) => i.id === (child.institution_id ?? "bncc-padrao"))
                  ?.subjects.find((s) => s.id === id)?.label ?? id
              }
              onSaved={() => {
                setShowProvaForm(false);
                today.refetch();
              }}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}

function ReviewSession({ reviews, childId, onDone }: { reviews: ReviewItem[]; childId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [i, setI] = useState(0);
  const [earned, setEarned] = useState(0);
  const item = reviews[i];

  async function grade(rating: 1 | 2 | 3 | 4) {
    try {
      const res = await api.review(childId, item.atom_id, rating);
      setEarned((e) => e + (res.coins_earned ?? 0));
    } catch {
      /* best-effort */
    }
    if (i + 1 < reviews.length) setI(i + 1);
    else {
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["coins"] });
      onDone();
    }
  }

  return (
    <div>
      <p style={{ color: "var(--bm-muted)" }}>
        {item.title} · {earned > 0 && <span>🪙 +{earned} nesta sessão</span>}
      </p>
      <QuizCard key={item.atom_id + i} q={item.question} index={i} total={reviews.length} onDone={grade} />
    </div>
  );
}

function ProvaForm({ childId, institutionId, classId, subjects, subjectLabel, onSaved }: {
  childId: string;
  institutionId: string;
  classId: string;
  subjects: string[];
  subjectLabel: (id: string) => string;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const tree = await api.tree({ institution: institutionId, class: classId, subject });
      const codes = tree.topics.map((t) => t.bncc_code);
      if (codes.length === 0) throw new Error("Sem tópicos verificados para essa disciplina ainda.");
      await api.createProva({ child_id: childId, title, subject_id: subject, exam_date: date, bncc_codes: codes });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String((e as Error).message || "Erro ao salvar."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: ".6rem", marginTop: ".9rem", borderTop: "1px solid var(--bm-border)", paddingTop: ".9rem" }}>
      <label>Disciplina
        <select className="bm-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">—</option>
          {subjects.map((sid) => (
            <option key={sid} value={sid}>{subjectLabel(sid)}</option>
          ))}
        </select>
      </label>
      <label>Título<input className="bm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Prova de Matemática" /></label>
      <label>Data<input className="bm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      {err && <ErrorNote>{err}</ErrorNote>}
      <button className="bm-btn" disabled={busy || !subject || !title || !date} onClick={save}>
        {busy ? "Salvando…" : "Salvar prova"}
      </button>
    </div>
  );
}
