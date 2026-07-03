import { useState } from "react";
import type { QuizQuestion } from "../../shared/contracts";
import { ratingFrom } from "../../shared/rating";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export function QuizCard({ q, index, total, onDone }: {
  q: QuizQuestion;
  index: number;
  total: number;
  onDone: (rating: 1 | 2 | 3 | 4) => void;
}) {
  const [start] = useState(() => Date.now());
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [wrongTries, setWrongTries] = useState(0);
  const [hints, setHints] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resolved, setResolved] = useState<null | "correct" | "gaveup">(null);

  function isCorrect(): boolean {
    if (q.kind === "mcq") return picked === q.answer_index;
    if (q.kind === "numeric") return Number(text.replace(",", ".")) === q.answer_number;
    if (q.kind === "short") return (q.accept ?? []).some((a) => norm(a) === norm(text));
    return false;
  }

  function submit() {
    if (resolved) return;
    if (isCorrect()) {
      setResolved("correct");
      return;
    }
    const tries = wrongTries + 1;
    setWrongTries(tries);
    // feedback que nomeia o equívoco (mcq) e faz a próxima pergunta
    const mis =
      q.kind === "mcq" && picked != null && q.options
        ? q.misconception_feedback?.[q.options[picked]]
        : undefined;
    setFeedback(mis ?? "Ainda não é isso. Que tal pedir uma dica? 🐻");
  }

  function askHint() {
    setHints((h) => Math.min(3, h + 1));
  }

  const rating = ratingFrom(hints, wrongTries, Date.now() - start, resolved === "gaveup");

  return (
    <div className="bm-card" style={{ marginBottom: "1rem" }}>
      <div style={{ color: "var(--bm-muted)", fontSize: ".85rem", marginBottom: ".3rem" }}>
        Pergunta {index + 1} de {total}
      </div>
      <p style={{ fontWeight: 600 }}>{q.prompt}</p>

      {q.kind === "mcq" && (
        <div style={{ display: "grid", gap: ".5rem" }}>
          {q.options?.map((opt, i) => {
            const state =
              resolved && i === q.answer_index ? "ok" : picked === i && resolved !== "correct" ? "sel" : "";
            return (
              <button
                key={i}
                className="bm-btn bm-btn-ghost"
                disabled={!!resolved}
                onClick={() => setPicked(i)}
                style={{
                  justifyContent: "flex-start",
                  outline: picked === i ? "2px solid var(--bm-primary)" : undefined,
                  borderColor: state === "ok" ? "var(--bm-success)" : undefined,
                  background: state === "ok" ? "color-mix(in srgb, var(--bm-success) 15%, transparent)" : undefined,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {(q.kind === "numeric" || q.kind === "short") && (
        <input
          className="bm-input"
          inputMode={q.kind === "numeric" ? "decimal" : "text"}
          value={text}
          disabled={!!resolved}
          onChange={(e) => setText(e.target.value)}
          placeholder="Sua resposta"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      )}

      {!resolved && (
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".8rem", flexWrap: "wrap" }}>
          <button className="bm-btn" onClick={submit} disabled={q.kind === "mcq" ? picked == null : !text}>
            Responder
          </button>
          {wrongTries > 0 && hints < 3 && (
            <button className="bm-btn bm-btn-ghost" onClick={askHint}>
              Pedir uma dica 🐻
            </button>
          )}
          {wrongTries > 0 && hints >= 3 && (
            <button className="bm-btn bm-btn-ghost" onClick={() => setResolved("gaveup")}>
              Ver a explicação
            </button>
          )}
        </div>
      )}

      {feedback && !resolved && <p style={{ color: "var(--bm-warn)", marginTop: ".6rem" }}>{feedback}</p>}

      {hints > 0 && !resolved && (
        <div style={{ marginTop: ".6rem", display: "grid", gap: ".3rem" }}>
          {q.hints.slice(0, hints).map((h, i) => (
            <p key={i} style={{ color: "var(--bm-muted)" }}>
              💡 {h}
            </p>
          ))}
        </div>
      )}

      {resolved && (
        <div style={{ marginTop: ".8rem" }}>
          <p style={{ fontWeight: 600, color: resolved === "correct" ? "var(--bm-success)" : "var(--bm-ink)" }}>
            {resolved === "correct" ? "✅ Isso mesmo!" : "Tudo bem — o importante é entender:"}
          </p>
          <p>{q.explanation}</p>
          {resolved === "correct" && hints > 0 && (
            <p style={{ color: "var(--bm-muted)" }}>Mandou bem — a dica ajudou, né? 👊</p>
          )}
          <button className="bm-btn" style={{ marginTop: ".6rem" }} onClick={() => onDone(rating)}>
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
