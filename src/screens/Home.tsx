import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { BearLoader, Mascot, Progress } from "../components/common";
import { QuizCard } from "../components/QuizCard";
import { api } from "../lib/api";
import { useMe, useToday, activeChild } from "../lib/queries";
import type { ReviewItem, ProvaCountdown } from "../../shared/contracts";

export function Home() {
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const today = useToday(child?.id ?? null);
  const [reviewing, setReviewing] = useState(false);

  if (me.isLoading || (child && today.isLoading)) return <BearLoader label="Carregando…" />;
  if (!child) return null;

  const reviews = today.data?.reviews ?? [];
  const provas = today.data?.provas ?? [];
  const streak = today.data?.streak ?? 0;

  if (reviewing && reviews.length > 0) {
    return (
      <Layout title={`Oi, ${child.display_name}!`} streak={streak}>
        <ReviewSession reviews={reviews} childId={child.id} onDone={() => { setReviewing(false); today.refetch(); }} />
      </Layout>
    );
  }

  return (
    <Layout title={`Oi, ${child.display_name}!`} streak={streak}>
      <div style={{ display: "grid", gap: "1.2rem" }}>
        {provas.map((p) => <ProvaCard key={p.id} p={p} />)}

        <section>
          <h2>Para revisar hoje</h2>
          {reviews.length === 0 ? (
            <Mascot mood="cheer" message={
              <>Tudo revisado! 🐻 Que tal <Link to="/estudar">estudar algo novo</Link>?</>
            } />
          ) : (
            <div className="bm-card" style={{ display: "grid", gap: ".6rem" }}>
              <p style={{ margin: 0 }}>Você tem <b>{reviews.length}</b> {reviews.length === 1 ? "revisão" : "revisões"} esperando. Leva pouquinho. 💪</p>
              <button className="bm-btn" onClick={() => setReviewing(true)}>Revisar agora</button>
            </div>
          )}
        </section>

        <section>
          <h2>Estudar algo novo</h2>
          <Link to="/estudar" className="bm-btn" style={{ textDecoration: "none", width: "100%" }}>✨ Escolher um tópico</Link>
        </section>
      </div>
    </Layout>
  );
}

function ProvaCard({ p }: { p: ProvaCountdown }) {
  const pct = Math.round(p.readiness * 100);
  return (
    <div className="bm-card" style={{ borderColor: "var(--bm-primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{p.title}</strong>
        <span style={{ color: "var(--bm-muted)" }}>{p.days_left === 0 ? "é hoje!" : `em ${p.days_left} dias`}</span>
      </div>
      <p style={{ margin: ".4rem 0" }}>Você está <b>{pct}% pronto</b>.</p>
      <Progress value={p.readiness} />
    </div>
  );
}

function ReviewSession({ reviews, childId, onDone }: { reviews: ReviewItem[]; childId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [i, setI] = useState(0);
  const item = reviews[i];

  async function grade(rating: 1 | 2 | 3 | 4) {
    try {
      await api.review(childId, item.atom_id, rating);
    } catch { /* best-effort */ }
    if (i + 1 < reviews.length) setI(i + 1);
    else {
      qc.invalidateQueries({ queryKey: ["today"] });
      onDone();
    }
  }

  return (
    <div>
      <p style={{ color: "var(--bm-muted)" }}>Revisão — sem espiar antes de tentar. 😉</p>
      <div style={{ color: "var(--bm-muted)", fontSize: ".85rem", marginBottom: ".5rem" }}>{item.title}</div>
      <QuizCard key={item.atom_id + i} q={item.question} index={i} total={reviews.length} onDone={grade} />
    </div>
  );
}
