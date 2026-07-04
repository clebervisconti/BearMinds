// Interação do curso (specs 14.2–14.3): canal de chat, Q&A com upvote e enquetes (Slido/Kahoot).
// Estudantes e equipe usam a mesma tela; o modo (staff × aluno) muda as ações disponíveis.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ErrorNote } from "../components/common";
import { api, ApiError, type ChatMessage, type QAItem, type PollView } from "../lib/api";
import { useMe, activeChild } from "../lib/queries";

type Tab = "chat" | "qa" | "polls";

export function CursoInteragir() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const me = useMe();
  const isStaff = (me.data?.parent.role ?? "guardian") !== "guardian";
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const childId = child?.id ?? "";
  const title = (loc.state as { title?: string } | null)?.title ?? "Curso";
  const [tab, setTab] = useState<Tab>("chat");

  if (me.isLoading) return <AppShell title="Interação"><ErrorNote>Carregando…</ErrorNote></AppShell>;
  if (!isStaff && !child) return <AppShell title="Interação"><ErrorNote>Escolha um perfil de estudante.</ErrorNote></AppShell>;

  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav(isStaff ? `/admin/curso/${id}` : `/curso/${id}`)} style={{ marginBottom: ".6rem" }}>← {title}</button>
      <div className="bm-page-head"><h1 style={{ fontSize: "1.3rem" }}>Interação · {title}</h1></div>

      <div className="bm-tabs">
        {([["chat", "💬 Chat"], ["qa", "❓ Perguntas"], ["polls", "📊 Enquetes"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} className={`bm-tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === "chat" && id && <ChatPanel courseId={id} childId={isStaff ? "" : childId} isStaff={isStaff} />}
      {tab === "qa" && id && <QAPanel courseId={id} childId={childId} isStaff={isStaff} />}
      {tab === "polls" && id && <PollsPanel courseId={id} childId={childId} isStaff={isStaff} />}

      <style>{`
        .bm-tabs{display:flex;gap:.3rem;border-bottom:1px solid var(--bm-border);margin-bottom:1rem}
        .bm-tab-btn{padding:.55rem .9rem;border:0;background:none;color:var(--bm-muted);font-weight:600;font-size:.9rem;
          cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
        .bm-tab-btn.active{color:var(--bm-link);border-bottom-color:var(--bm-primary)}
      `}</style>
    </AppShell>
  );
}

// ---------------- Chat do canal (+ DM privada estudante↔staff) ----------------
function ChatPanel({ courseId, childId, isStaff }: { courseId: string; childId: string; isStaff: boolean }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [dm, setDm] = useState<string | null>(null);   // thread id quando em conversa privada
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = dm ? await api.chatThreadMsgs(dm, childId) : await api.chatChannel(courseId, childId);
      setMsgs(r.messages);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao carregar o chat.");
    }
  }, [courseId, childId, dm]);

  useEffect(() => {
    setMsgs([]);
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [msgs]);

  async function openDm() {
    try { const r = await api.chatOpenThread(courseId, childId); setDm(r.id); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Não foi possível abrir a conversa."); }
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      if (dm) await api.chatThreadSend(dm, childId, body);
      else await api.chatChannelSend(courseId, isStaff ? null : childId, body);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao enviar.");
      setText(body);
    }
  }

  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      {err && <ErrorNote>{err}</ErrorNote>}
      {!isStaff && (
        <div style={{ display: "flex", gap: ".4rem" }}>
          <button className={`bm-btn-sm ${!dm ? "bm-btn" : "bm-btn bm-btn-ghost"}`} onClick={() => setDm(null)}>💬 Canal do curso</button>
          <button className={`bm-btn-sm ${dm ? "bm-btn" : "bm-btn bm-btn-ghost"}`} onClick={openDm}>🔒 Falar com o professor</button>
        </div>
      )}
      <div className="bm-card" style={{ padding: ".8rem", height: "min(52vh, 460px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: ".5rem" }} ref={boxRef}>
        {msgs.length === 0 && <p className="sub" style={{ margin: "auto" }}>{dm ? "Conversa privada com o professor — envie sua dúvida." : "Nenhuma mensagem ainda. Comece a conversa! 🐻"}</p>}
        {msgs.map((m) => {
          const mine = m.sender_child_id === childId && childId !== "";
          const staff = !!m.sender_parent_id;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              <div style={{ display: "flex", gap: ".4rem", alignItems: "baseline", marginBottom: 2 }}>
                <span style={{ fontSize: ".74rem", fontWeight: 700, color: staff ? "var(--bm-primary)" : "var(--bm-muted)" }}>
                  {staff ? "👩‍🏫 " : ""}{m.sender_name}
                </span>
              </div>
              <div className="bm-card-flat" style={{ padding: ".5rem .75rem", background: mine ? "color-mix(in srgb,var(--bm-primary) 12%,transparent)" : "var(--bm-surface-2)", borderRadius: 12 }}>
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: ".5rem" }}>
        <input className="bm-input" placeholder={dm ? "Mensagem para o professor…" : "Escreva uma mensagem…"} value={text} maxLength={1000}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="bm-btn" onClick={send} disabled={!text.trim()}>Enviar</button>
      </div>
      <p className="bm-meta">{dm ? "Conversa privada com a equipe do curso." : "Canal do curso — moderado pela equipe. Trate os colegas com respeito."}</p>
    </div>
  );
}

// ---------------- Q&A com upvote ----------------
function QAPanel({ courseId, childId, isStaff }: { courseId: string; childId: string; isStaff: boolean }) {
  const [items, setItems] = useState<QAItem[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.qaList(courseId, childId);
      setItems(r.questions);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao carregar.");
    }
  }, [courseId, childId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  async function ask() {
    const body = text.trim();
    if (!body || !childId) return;
    setText("");
    try { await api.qaAsk(courseId, childId, body); await load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao enviar."); setText(body); }
  }
  async function vote(q: QAItem) {
    if (!childId || q.voted) return;
    try { await api.qaVote(q.id, childId); await load(); } catch { /* ignore */ }
  }
  async function markAnswered(q: QAItem) {
    try { await api.qaAnswered(q.id); await load(); } catch { /* ignore */ }
  }

  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      {err && <ErrorNote>{err}</ErrorNote>}
      {!isStaff && (
        <div style={{ display: "flex", gap: ".5rem" }}>
          <input className="bm-input" placeholder="Faça uma pergunta ao professor…" value={text} maxLength={400}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
          <button className="bm-btn" onClick={ask} disabled={!text.trim()}>Perguntar</button>
        </div>
      )}
      {items.length === 0 && <p className="sub">Sem perguntas ainda. As mais votadas sobem para o topo.</p>}
      {items.map((q) => (
        <div key={q.id} className="bm-card-flat" style={{ padding: ".7rem .9rem", display: "flex", gap: ".7rem", alignItems: "flex-start", opacity: q.answered ? 0.7 : 1 }}>
          <button className="bm-vote" onClick={() => vote(q)} disabled={isStaff || !!q.voted} aria-label="Votar" style={{ color: q.voted ? "var(--bm-primary)" : "var(--bm-muted)" }}>
            <span style={{ fontSize: "1rem" }}>▲</span>
            <span style={{ fontWeight: 700 }}>{q.votes}</span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 550 }}>{q.body}</div>
            <div className="bm-meta">{q.author}{q.answered ? " · ✓ respondida" : ""}</div>
          </div>
          {isStaff && !q.answered && <button className="bm-btn-quiet bm-btn-sm" onClick={() => markAnswered(q)}>✓ Marcar respondida</button>}
        </div>
      ))}
      <style>{`.bm-vote{display:flex;flex-direction:column;align-items:center;min-width:2.4rem;padding:.3rem;border:1px solid var(--bm-border);border-radius:10px;background:var(--bm-surface);cursor:pointer}
        .bm-vote:disabled{cursor:default}`}</style>
    </div>
  );
}

// ---------------- Enquetes ----------------
function PollsPanel({ courseId, childId, isStaff }: { courseId: string; childId: string; isStaff: boolean }) {
  const [polls, setPolls] = useState<PollView[]>([]);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPolls((await api.polls(courseId, childId)).polls); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao carregar."); }
  }, [courseId, childId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  async function vote(p: PollView, i: number) {
    if (isStaff || !childId || p.my_choice !== null || !p.open) return;
    try { await api.votePoll(p.id, childId, i); await load(); } catch { /* ignore */ }
  }

  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      {err && <ErrorNote>{err}</ErrorNote>}
      {isStaff && (
        <div>
          <button className="bm-btn bm-btn-sm" onClick={() => setCreating((v) => !v)}>{creating ? "Fechar" : "+ Nova enquete"}</button>
          {creating && <NewPoll courseId={courseId} onCreated={() => { setCreating(false); void load(); }} />}
        </div>
      )}
      {polls.length === 0 && <p className="sub">Nenhuma enquete ainda.</p>}
      {polls.map((p) => {
        const voted = p.my_choice !== null;
        return (
          <div key={p.id} className="bm-card" style={{ display: "grid", gap: ".5rem" }}>
            <div style={{ fontWeight: 650 }}>{p.question}</div>
            {p.options.map((opt, i) => {
              const votes = p.tally[i] ?? 0;
              const pct = p.total ? Math.round((votes / p.total) * 100) : 0;
              const show = voted || isStaff;
              return (
                <button key={i} className="bm-poll-opt" disabled={isStaff || voted || !p.open} onClick={() => vote(p, i)}>
                  <div className="bm-poll-bar" style={{ width: show ? `${pct}%` : 0 }} />
                  <span className="bm-poll-label">
                    {p.my_choice === i && "✓ "}{opt}{show ? ` · ${pct}%` : ""}
                  </span>
                </button>
              );
            })}
            <div className="bm-meta">{p.total} voto(s){!p.open ? " · encerrada" : ""}</div>
          </div>
        );
      })}
      <style>{`.bm-poll-opt{position:relative;overflow:hidden;text-align:left;padding:.6rem .8rem;border:1px solid var(--bm-border);
        border-radius:10px;background:var(--bm-surface);cursor:pointer;min-height:42px}
        .bm-poll-opt:disabled{cursor:default}
        .bm-poll-bar{position:absolute;inset:0 auto 0 0;background:color-mix(in srgb,var(--bm-primary) 16%,transparent);transition:width .4s}
        .bm-poll-label{position:relative;font-size:.9rem;font-weight:550}`}</style>
    </div>
  );
}

function NewPoll({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
  const [question, setQuestion] = useState("");
  const [opts, setOpts] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const options = opts.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 3 || options.length < 2) { setErr("Pergunta e ao menos 2 opções."); return; }
    setBusy(true); setErr(null);
    try { await api.createPoll({ course_id: courseId, question: question.trim(), options }); onCreated(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao criar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="bm-card" style={{ display: "grid", gap: ".5rem", marginTop: ".6rem" }}>
      <input className="bm-input" placeholder="Pergunta da enquete" value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} />
      {opts.map((o, i) => (
        <input key={i} className="bm-input" placeholder={`Opção ${i + 1}`} value={o} maxLength={80}
          onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      <div style={{ display: "flex", gap: ".5rem" }}>
        {opts.length < 6 && <button className="bm-btn-quiet bm-btn-sm" onClick={() => setOpts([...opts, ""])}>+ opção</button>}
        <button className="bm-btn bm-btn-sm" disabled={busy} onClick={save} style={{ marginLeft: "auto" }}>{busy ? "Criando…" : "Publicar enquete"}</button>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
    </div>
  );
}
