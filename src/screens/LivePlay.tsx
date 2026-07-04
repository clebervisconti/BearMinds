// Jogo ao vivo — lado do estudante (spec 14.1). Entra por PIN, responde cronometrado, vê pódio.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ErrorNote } from "../components/common";
import { api, ApiError, type LiveState } from "../lib/api";
import { useMe, activeChild } from "../lib/queries";

const OPT_COLORS = ["#e0284d", "#1668dc", "#c98a00", "#12805c", "#6d28d9", "#0e7490"];
const OPT_SHAPES = ["▲", "◆", "●", "■", "★", "♦"];

export function LivePlay() {
  const [params] = useSearchParams();
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;

  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<LiveState | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQ = useRef<number>(-1);

  const poll = useCallback(async () => {
    if (!child) return;
    try {
      const s = await api.liveState(pin, child.id);
      setState(s);
      if (s.current_q !== lastQ.current) {   // nova pergunta → limpa seleção
        lastQ.current = s.current_q;
        setPicked(null);
        setLastDelta(null);
      }
    } catch {
      /* transitório — mantém último estado */
    }
  }, [pin, child?.id]);

  // relógio para a barra de tempo
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!joined) return;
    void poll();
    pollRef.current = setInterval(() => void poll(), 1200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [joined, poll]);

  async function join() {
    if (!child || pin.length !== 6) return;
    setErr(null);
    try {
      await api.liveJoin(pin, child.id);
      setJoined(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Não foi possível entrar.");
    }
  }

  async function answer(choice: number) {
    if (!child || picked !== null || !state?.question) return;
    setPicked(choice);
    try {
      const r = await api.liveAnswer(pin, child.id, choice);
      setLastDelta(r.delta);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao responder.");
      setPicked(null);
    }
  }

  if (!child) {
    return <AppShell title="Jogo ao vivo"><ErrorNote>Escolha um perfil de estudante para jogar.</ErrorNote></AppShell>;
  }

  // ---- entrada (lobby de PIN) ----
  if (!joined) {
    return (
      <AppShell>
        <div className="bm-live-enter">
          <div className="bm-live-badge">📡 AO VIVO</div>
          <h1>Entrar no jogo</h1>
          <p className="sub">Digite o PIN que o professor mostrou na tela.</p>
          <input
            className="bm-pin-input"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            aria-label="PIN do jogo"
          />
          {err && <ErrorNote>{err}</ErrorNote>}
          <button className="bm-btn bm-btn-lg" disabled={pin.length !== 6} onClick={join}>Entrar como {child.display_name}</button>
        </div>
        {styles}
      </AppShell>
    );
  }

  const q = state?.question ?? null;
  const isReveal = state?.state === "reveal";
  const started = q?.started_at ? new Date(q.started_at).getTime() : null;
  const remaining = started && q ? Math.max(0, q.window_ms - (now - started)) : 0;
  const pct = q ? Math.max(0, Math.min(1, remaining / q.window_ms)) : 0;

  return (
    <AppShell>
      {err && <ErrorNote>{err}</ErrorNote>}

      {/* lobby */}
      {state?.state === "lobby" && (
        <div className="bm-live-enter">
          <div className="bm-live-badge">📡 CONECTADO</div>
          <div className="bm-bear-bounce" style={{ fontSize: "3.5rem" }} aria-hidden>🐻</div>
          <h1>Você entrou!</h1>
          <p className="sub">Aguardando o professor iniciar… {state.players_count} jogador(es) na sala.</p>
        </div>
      )}

      {/* pergunta / reveal */}
      {(state?.state === "question" || isReveal) && q && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="bm-eyebrow">Pergunta {q.index + 1} de {state?.total}</span>
            {!isReveal && <span className="bm-chip">⏱ {Math.ceil(remaining / 1000)}s</span>}
          </div>
          {!isReveal && (
            <div className="bm-timer"><div className="bm-timer-fill" style={{ width: `${pct * 100}%` }} /></div>
          )}
          <h1 style={{ fontSize: "1.35rem", lineHeight: 1.3 }}>{q.prompt}</h1>

          <div className="bm-live-grid">
            {q.options.map((opt, i) => {
              const correct = isReveal && q.answer_index === i;
              const wrongPick = isReveal && picked === i && q.answer_index !== i;
              return (
                <button
                  key={i}
                  className="bm-live-opt"
                  disabled={picked !== null || isReveal}
                  onClick={() => answer(i)}
                  style={{
                    background: OPT_COLORS[i],
                    opacity: isReveal && !correct ? 0.4 : picked !== null && picked !== i ? 0.5 : 1,
                    outline: picked === i ? "4px solid #fff" : correct ? "4px solid #fff" : "none",
                    boxShadow: correct ? "0 0 0 4px var(--bm-success)" : wrongPick ? "0 0 0 4px var(--bm-danger)" : "none",
                  }}
                >
                  <span className="bm-live-shape" aria-hidden>{OPT_SHAPES[i]}</span>
                  <span>{opt}</span>
                  {correct && <span className="bm-live-mark">✓</span>}
                </button>
              );
            })}
          </div>

          {picked !== null && !isReveal && <p className="sub" style={{ textAlign: "center" }}>Resposta enviada — aguarde os outros jogadores…</p>}
          {isReveal && (
            <div className="bm-card-flat" style={{ textAlign: "center", padding: "1rem" }}>
              {picked === null ? <span className="sub">Você não respondeu a tempo.</span>
                : lastDelta && lastDelta > 0 ? <span style={{ color: "var(--bm-success)", fontWeight: 700, fontSize: "1.1rem" }}>✓ Acertou! +{lastDelta} pontos</span>
                : <span style={{ color: "var(--bm-danger)", fontWeight: 700 }}>Não foi dessa vez.</span>}
            </div>
          )}
        </div>
      )}

      {/* pódio */}
      {state?.state === "ended" && (
        <div className="bm-live-enter">
          <div className="bm-live-badge">🏆 FIM DE JOGO</div>
          <h1>Pódio</h1>
          <div className="bm-podium">
            {(state.podium ?? []).map((p, i) => (
              <div key={p.child_id} className={`bm-podium-row${p.child_id === child.id ? " me" : ""}`}>
                <span className="pos">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`}</span>
                <span style={{ flex: 1 }}>{p.nickname}{p.child_id === child.id ? " (você)" : ""}</span>
                <strong>{p.score}</strong>
              </div>
            ))}
            {(state.podium ?? []).length === 0 && <p className="sub">Sem pontuações registradas.</p>}
          </div>
          <a className="bm-btn bm-btn-ghost" href="/" style={{ textDecoration: "none" }}>Voltar ao início</a>
        </div>
      )}

      {styles}
    </AppShell>
  );
}

const styles = (
  <style>{`
    .bm-live-enter{max-width:440px;margin:1rem auto;display:grid;gap:.9rem;justify-items:center;text-align:center}
    .bm-live-enter h1{font-size:1.6rem}
    .bm-live-badge{font-size:.72rem;font-weight:800;letter-spacing:.12em;color:var(--bm-primary);
      background:color-mix(in srgb,var(--bm-primary) 12%,transparent);padding:.3rem .7rem;border-radius:999px}
    .bm-pin-input{font-size:2.6rem;font-weight:800;letter-spacing:.5rem;text-align:center;width:100%;
      padding:.8rem .5rem;border:2px solid var(--bm-border);border-radius:16px;background:var(--bm-surface);color:var(--bm-ink)}
    .bm-pin-input:focus{outline:none;border-color:var(--bm-primary)}
    .bm-btn-lg{padding:.85rem 1.4rem;font-size:1rem;width:100%}
    .bm-timer{height:10px;background:var(--bm-surface-2);border-radius:999px;overflow:hidden}
    .bm-timer-fill{height:100%;background:var(--bm-accent);transition:width .2s linear}
    .bm-live-grid{display:grid;grid-template-columns:1fr;gap:.6rem}
    @media(min-width:560px){.bm-live-grid{grid-template-columns:1fr 1fr}}
    .bm-live-opt{position:relative;display:flex;align-items:center;gap:.7rem;padding:1.1rem 1rem;border:0;border-radius:14px;
      color:#fff;font-weight:650;font-size:1rem;text-align:left;cursor:pointer;transition:opacity .15s,transform .1s;min-height:64px}
    .bm-live-opt:not(:disabled):active{transform:scale(.98)}
    .bm-live-shape{font-size:1.2rem}
    .bm-live-mark{margin-left:auto;font-size:1.3rem}
    .bm-podium{width:100%;display:grid;gap:.5rem}
    .bm-podium-row{display:flex;align-items:center;gap:.7rem;padding:.7rem .9rem;border-radius:12px;background:var(--bm-surface-2);font-size:.95rem}
    .bm-podium-row.me{outline:2px solid var(--bm-primary)}
    .bm-podium-row .pos{font-size:1.2rem;width:2rem;text-align:center}
    @keyframes bmb{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}.bm-bear-bounce{animation:bmb 1s ease-in-out infinite}
  `}</style>
);
