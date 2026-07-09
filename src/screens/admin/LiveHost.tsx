// Jogo ao vivo — console do professor (spec 14.1). Cria a sessão pelo item de quiz,
// mostra o PIN, controla o ritmo (começar → revelar → próxima) e o pódio. Estado por polling.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError, type LiveState } from "../../lib/api";
import { useRealtimeChannel } from "../../lib/liveSocket";

const OPT_COLORS = ["#e0284d", "#1668dc", "#c98a00", "#12805c", "#6d28d9", "#0e7490"];
const OPT_SHAPES = ["▲", "◆", "●", "■", "★", "♦"];

export function LiveHost() {
  const { itemId } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState<{ id: string; pin: string; total: number } | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [results, setResults] = useState<{ players: { nickname: string; score: number }[]; answered: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // cria a sessão uma única vez
  useEffect(() => {
    if (startedRef.current || !itemId) return;
    startedRef.current = true;
    api.liveStart(itemId)
      .then((r) => setSession({ id: r.id, pin: r.pin, total: r.total_questions }))
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Não foi possível iniciar o jogo."));
  }, [itemId]);

  const poll = useCallback(async () => {
    if (!session) return;
    try {
      const [s, r] = await Promise.all([api.liveState(session.pin, ""), api.liveResults(session.id)]);
      setState(s);
      setResults({ players: r.players, answered: r.answered });
    } catch { /* transitório */ }
  }, [session?.id, session?.pin]);

  // Tempo real (P6): WS avisa "algo mudou" → refetch pelo mesmo `poll()`. Cai para polling se a WS não conectar.
  const wsConnected = useRealtimeChannel(session ? `/ws/live/${session.pin}` : null, () => void poll());

  useEffect(() => {
    if (!session) return;
    void poll();
    if (wsConnected) return;
    pollRef.current = setInterval(() => void poll(), 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session, poll, wsConnected]);

  async function advance() {
    if (!session) return;
    setBusy(true);
    try {
      await api.liveNext(session.id);
      await poll();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao avançar.");
    } finally {
      setBusy(false);
    }
  }

  if (err) return <AppShell><ErrorNote>{err}</ErrorNote><button className="bm-btn bm-btn-ghost bm-btn-sm" style={{ marginTop: ".8rem" }} onClick={() => nav(-1)}>← Voltar</button></AppShell>;
  if (!session || !state) return <AppShell><BearLoader label="Preparando a sala…" /></AppShell>;

  const q = state.question;
  const st = state.state;
  const last = state.current_q + 1 >= session.total;
  const btnLabel = st === "lobby" ? "▶ Começar jogo"
    : st === "question" ? "Revelar resposta"
    : st === "reveal" ? (last ? "🏆 Ver pódio" : "Próxima pergunta →")
    : null;

  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav(-1)} style={{ marginBottom: ".6rem" }}>← Sair do modo ao vivo</button>

      {/* lobby: PIN gigante */}
      {st === "lobby" && (
        <div className="bm-host-lobby">
          <div className="bm-live-badge">📡 SALA ABERTA</div>
          <p className="sub">Peça aos alunos para abrir <b>BearMinds → Ao vivo</b> e digitar o PIN:</p>
          <div className="bm-pin-display">{session.pin}</div>
          <div className="bm-host-count">👥 {state.players_count} jogador(es) na sala</div>
          <button className="bm-btn bm-btn-lg" disabled={busy || state.players_count === 0} onClick={advance}>
            {state.players_count === 0 ? "Aguardando jogadores…" : btnLabel}
          </button>
        </div>
      )}

      {/* pergunta / reveal */}
      {(st === "question" || st === "reveal") && q && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: ".5rem" }}>
            <span className="bm-eyebrow">Pergunta {q.index + 1} de {session.total}</span>
            <span className="bm-chip">✅ {results?.answered ?? 0}/{state.players_count} responderam · PIN {session.pin}</span>
          </div>
          <h1 style={{ fontSize: "1.5rem", lineHeight: 1.3 }}>{q.prompt}</h1>
          <div className="bm-live-grid">
            {q.options.map((opt, i) => {
              const correct = st === "reveal" && q.answer_index === i;
              return (
                <div key={i} className="bm-live-opt" style={{ background: OPT_COLORS[i], opacity: st === "reveal" && !correct ? 0.4 : 1, boxShadow: correct ? "0 0 0 4px var(--bm-success)" : "none" }}>
                  <span className="bm-live-shape" aria-hidden>{OPT_SHAPES[i]}</span>
                  <span>{opt}</span>
                  {correct && <span className="bm-live-mark">✓</span>}
                </div>
              );
            })}
          </div>
          <button className="bm-btn bm-btn-lg" disabled={busy} onClick={advance}>{btnLabel}</button>
          {/* placar parcial */}
          {results && results.players.length > 0 && (
            <div className="bm-card-flat" style={{ padding: ".8rem 1rem" }}>
              <div className="bm-eyebrow" style={{ marginBottom: ".4rem" }}>Placar</div>
              {results.players.slice(0, 5).map((p, i) => (
                <div key={i} style={{ display: "flex", gap: ".6rem", padding: ".2rem 0", fontSize: ".9rem" }}>
                  <span style={{ width: "1.5rem", color: "var(--bm-muted)" }}>{i + 1}º</span>
                  <span style={{ flex: 1 }}>{p.nickname}</span><strong>{p.score}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* pódio */}
      {st === "ended" && (
        <div className="bm-host-lobby">
          <div className="bm-live-badge">🏆 FIM DE JOGO</div>
          <h1 style={{ fontSize: "1.6rem" }}>Pódio final</h1>
          <div className="bm-podium">
            {(results?.players ?? []).map((p, i) => (
              <div key={i} className="bm-podium-row">
                <span className="pos">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`}</span>
                <span style={{ flex: 1 }}>{p.nickname}</span><strong>{p.score}</strong>
              </div>
            ))}
            {(results?.players ?? []).length === 0 && <p className="sub">Sem pontuações.</p>}
          </div>
          <button className="bm-btn bm-btn-ghost" onClick={() => nav(-1)}>Concluir</button>
        </div>
      )}

      <style>{`
        .bm-host-lobby{max-width:560px;margin:1rem auto;display:grid;gap:1rem;justify-items:center;text-align:center}
        .bm-live-badge{font-size:.72rem;font-weight:800;letter-spacing:.12em;color:var(--bm-link);
          background:color-mix(in srgb,var(--bm-primary) 12%,transparent);padding:.3rem .7rem;border-radius:999px}
        .bm-pin-display{font-size:4rem;font-weight:900;letter-spacing:.4rem;color:var(--bm-ink);
          background:var(--bm-surface-2);padding:1rem 1.6rem;border-radius:20px;line-height:1}
        @media(min-width:600px){.bm-pin-display{font-size:5.5rem}}
        .bm-host-count{font-weight:650;color:var(--bm-muted)}
        .bm-btn-lg{padding:.9rem 1.6rem;font-size:1.05rem}
        .bm-live-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
        .bm-live-opt{position:relative;display:flex;align-items:center;gap:.7rem;padding:1.1rem 1rem;border-radius:14px;
          color:#fff;font-weight:650;font-size:1rem;min-height:66px;transition:opacity .15s}
        .bm-live-shape{font-size:1.2rem}
        .bm-live-mark{margin-left:auto;font-size:1.4rem}
        .bm-podium{width:100%;display:grid;gap:.5rem}
        .bm-podium-row{display:flex;align-items:center;gap:.7rem;padding:.75rem .9rem;border-radius:12px;background:var(--bm-surface-2)}
        .bm-podium-row .pos{font-size:1.3rem;width:2.2rem;text-align:center}
      `}</style>
    </AppShell>
  );
}
