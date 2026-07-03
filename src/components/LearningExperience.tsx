import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { GenerateBundle } from "../../shared/contracts";
import { api } from "../lib/api";
import { Mascot, Progress } from "./common";
import { Explorable } from "./Explorable";
import { QuizCard } from "./QuizCard";

type Phase = "warmup" | "lesson" | "explorable" | "quiz" | "done";

// Loop de aprendizagem think-first (spec 05.4): pergunta → lição → explorável → quiz → fecho FSRS.
export function LearningExperience({ bundle, childId, onFinish }: {
  bundle: GenerateBundle;
  childId: string;
  onFinish: () => void;
}) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("warmup");
  const [qi, setQi] = useState(0);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);

  if (bundle.lesson.refused) {
    return (
      <Mascot
        mood="calm"
        message={
          <>
            <b>Ainda não consigo ensinar isso com segurança.</b>
            <p style={{ margin: ".4rem 0 0" }}>
              {bundle.lesson.reason || "Não temos material verificado suficiente para este tópico."} Escolha outro
              tópico e voltamos aqui quando o conteúdo estiver pronto. 🐻
            </p>
          </>
        }
      />
    );
  }

  const questions = bundle.quiz.questions;
  const progress =
    phase === "warmup" ? 0.1 : phase === "lesson" ? 0.3 : phase === "explorable" ? 0.5 : phase === "quiz" ? 0.6 + (qi / Math.max(1, questions.length)) * 0.4 : 1;

  async function gradeQuestion(rating: 1 | 2 | 3 | 4) {
    const q = questions[qi];
    if (q.atom_id) {
      try {
        const res = await api.review(childId, q.atom_id, rating);
        setNextDue(res.due);
        setCoinsEarned((c) => c + (res.coins_earned ?? 0));
      } catch {
        /* progresso é best-effort na UI; o servidor é a fonte da verdade */
      }
    }
    if (qi + 1 < questions.length) setQi(qi + 1);
    else {
      setPhase("done");
      // atualiza moedas/notificações/fila no shell
      qc.invalidateQueries({ queryKey: ["coins"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["today"] });
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <Progress value={progress} />
      </div>
      <h1 style={{ fontSize: "1.3rem" }}>{bundle.title}</h1>

      {phase === "warmup" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <Mascot mood="think" message={bundle.lesson.warmup_question || "O que você já sabe sobre isso?"} />
          <p style={{ color: "var(--bm-muted)" }}>
            Pense um pouquinho antes de ver a explicação — é assim que a memória fica mais forte. Não precisa acertar. 😉
          </p>
          <button className="bm-btn" onClick={() => setPhase("lesson")}>
            Já pensei, bora aprender →
          </button>
        </div>
      )}

      {phase === "lesson" && (
        <div style={{ display: "grid", gap: ".8rem" }}>
          {bundle.lesson.sections.map((s, i) => (
            <div key={i} className="bm-card">
              <p style={{ fontWeight: 600, margin: 0 }}>{s.claim}</p>
              <p style={{ margin: ".4rem 0 0", color: "var(--bm-muted)" }}>{s.explanation}</p>
            </div>
          ))}
          <Mascot message={bundle.lesson.companion_note} />
          <button className="bm-btn" onClick={() => setPhase(bundle.explorable ? "explorable" : "quiz")}>
            {bundle.explorable ? "Mexer no interativo 🔬" : "Ir para o quiz ✍️"}
          </button>
        </div>
      )}

      {phase === "explorable" && bundle.explorable && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <Explorable e={bundle.explorable} />
          <button className="bm-btn" onClick={() => setPhase("quiz")}>
            Agora testar o que aprendi ✍️
          </button>
        </div>
      )}

      {phase === "quiz" && questions.length > 0 && (
        <QuizCard q={questions[qi]} index={qi} total={questions.length} onDone={gradeQuestion} />
      )}
      {phase === "quiz" && questions.length === 0 && (
        <button className="bm-btn" onClick={() => setPhase("done")}>
          Concluir
        </button>
      )}

      {phase === "done" && (
        <div style={{ display: "grid", gap: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem" }}>🎉</div>
          <Mascot
            mood="cheer"
            message={
              <>
                <b>Você lembra de coisas novas de {bundle.title}!</b>
                <p style={{ margin: ".4rem 0 0" }}>
                  {nextDue
                    ? `Voltamos a isso em ${daysUntil(nextDue)} 👊 (assim você não esquece).`
                    : "Volto a te lembrar disso no momento certo. 👊"}
                  {coinsEarned > 0 && <> Você ganhou <b>🪙 {coinsEarned}</b> nesta lição.</>}
                </p>
              </>
            }
          />
          {bundle.citations.length > 0 && (
            <details style={{ textAlign: "left" }}>
              <summary style={{ color: "var(--bm-muted)", cursor: "pointer" }}>De onde veio esse conteúdo</summary>
              <ul style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>
                {bundle.citations.map((c) => (
                  <li key={c.id}>{c.ref}</li>
                ))}
              </ul>
            </details>
          )}
          <button className="bm-btn" onClick={onFinish}>
            Voltar para o início
          </button>
        </div>
      )}
    </div>
  );
}

function daysUntil(iso: string): string {
  const d = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (d <= 0) return "hoje mesmo";
  if (d === 1) return "1 dia";
  return `${d} dias`;
}
