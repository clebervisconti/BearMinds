// Coaching / tutoria (spec 14.4): painel de alunos em risco + anotações, e caixa de DMs (spec 14.3).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError, type CoachStudent, type ChatMessage } from "../../lib/api";
import { useMe } from "../../lib/queries";

type Tab = "risk" | "dm";

export function AdminCoaching() {
  const nav = useNavigate();
  const me = useMe();
  const role = me.data?.parent.role ?? "guardian";
  const [tab, setTab] = useState<Tab>("risk");

  if (me.isLoading) return <AppShell title="Coaching"><BearLoader /></AppShell>;
  if (role === "guardian") return <AppShell title="Coaching"><ErrorNote>Área restrita à equipe.</ErrorNote></AppShell>;

  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav("/admin")} style={{ marginBottom: ".6rem" }}>← Administração</button>
      <div className="bm-page-head"><h1>Coaching & tutoria</h1><div className="sub">Acompanhe quem precisa de apoio e converse em particular.</div></div>

      <div className="bm-tabs">
        <button className={`bm-tab-btn${tab === "risk" ? " active" : ""}`} onClick={() => setTab("risk")}>🎯 Acompanhamento</button>
        <button className={`bm-tab-btn${tab === "dm" ? " active" : ""}`} onClick={() => setTab("dm")}>💬 Mensagens</button>
      </div>

      {tab === "risk" ? <RiskList /> : <DMInbox />}

      <style>{`
        .bm-tabs{display:flex;gap:.3rem;border-bottom:1px solid var(--bm-border);margin-bottom:1rem}
        .bm-tab-btn{padding:.55rem .9rem;border:0;background:none;color:var(--bm-muted);font-weight:600;font-size:.9rem;
          cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
        .bm-tab-btn.active{color:var(--bm-link);border-bottom-color:var(--bm-primary)}
      `}</style>
    </AppShell>
  );
}

// ---------------- Lista de acompanhamento ----------------
function RiskList() {
  const [students, setStudents] = useState<CoachStudent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<string | null>(null);

  useEffect(() => {
    api.coaching().then((r) => setStudents(r.students)).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, []);

  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!students) return <BearLoader label="Carregando alunos…" />;
  const atRisk = students.filter((s) => s.at_risk).length;

  return (
    <div style={{ display: "grid", gap: ".6rem" }}>
      <div className="bm-card-flat" style={{ padding: ".7rem 1rem", fontSize: ".9rem" }}>
        <b style={{ color: atRisk ? "var(--bm-warn)" : "var(--bm-success)" }}>{atRisk}</b> aluno(s) em risco de {students.length} acompanhados.
        Sinais: streak quebrado, prontidão &lt; 60% ou 7+ dias inativo.
      </div>
      {students.length === 0 && <p className="sub">Nenhum estudante na instituição ainda.</p>}
      {students.map((s) => (
        <div key={s.id} className="bm-card" style={{ display: "grid", gap: ".5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".7rem", flexWrap: "wrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: s.at_risk ? "var(--bm-warn)" : "var(--bm-success)" }} aria-hidden />
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontWeight: 620 }}>{s.display_name}</div>
              <div className="bm-meta">{s.grade}{s.last_activity_days !== null ? ` · ativo há ${s.last_activity_days}d` : " · sem atividade"}{s.min_readiness !== null ? ` · prontidão ${Math.round(s.min_readiness * 100)}%` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
              {s.flags.streak_broken && <span className="bm-chip bm-chip-outline" style={{ color: "var(--bm-warn)", fontSize: ".72rem" }}>streak quebrado</span>}
              {s.flags.low_readiness && <span className="bm-chip bm-chip-outline" style={{ color: "var(--bm-danger)", fontSize: ".72rem" }}>prontidão baixa</span>}
              {s.flags.inactive_7d && <span className="bm-chip bm-chip-outline" style={{ color: "var(--bm-muted)", fontSize: ".72rem" }}>inativo 7d+</span>}
            </div>
            <button className="bm-btn-quiet bm-btn-sm" onClick={() => setOpenNotes(openNotes === s.id ? null : s.id)}>
              📝 Anotações{s.notes ? ` (${s.notes})` : ""}
            </button>
          </div>
          {openNotes === s.id && <NotesPanel childId={s.id} />}
        </div>
      ))}
    </div>
  );
}

function NotesPanel({ childId }: { childId: string }) {
  const [notes, setNotes] = useState<{ id: string; body: string; created_at: string; author: string }[] | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.coachNotes(childId).then((r) => setNotes(r.notes)).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, [childId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const body = text.trim();
    if (!body) return;
    setText("");
    try { await api.coachAddNote(childId, body); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao salvar."); setText(body); }
  }

  return (
    <div style={{ borderTop: "1px solid var(--bm-border)", paddingTop: ".6rem", display: "grid", gap: ".5rem" }}>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div style={{ display: "flex", gap: ".5rem" }}>
        <input className="bm-input" placeholder="Nova anotação de acompanhamento…" value={text} maxLength={1000}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="bm-btn bm-btn-sm" onClick={add} disabled={!text.trim()}>Salvar</button>
      </div>
      {notes?.map((n) => (
        <div key={n.id} className="bm-card-flat" style={{ padding: ".5rem .75rem" }}>
          <div style={{ fontSize: ".9rem" }}>{n.body}</div>
          <div className="bm-meta">{n.author.split("@")[0]} · {new Date(n.created_at).toLocaleDateString("pt-BR")}</div>
        </div>
      ))}
      {notes && notes.length === 0 && <p className="bm-meta">Sem anotações ainda.</p>}
    </div>
  );
}

// ---------------- Caixa de DMs (staff) ----------------
function DMInbox() {
  const [threads, setThreads] = useState<{ id: string; course_title: string; student: string; last_body: string | null }[] | null>(null);
  const [open, setOpen] = useState<{ id: string; who: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.chatStaffInbox().then((r) => setThreads(r.threads)).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, []);

  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (open) return <ThreadView threadId={open.id} who={open.who} onBack={() => setOpen(null)} />;
  if (!threads) return <BearLoader label="Carregando conversas…" />;

  return (
    <div style={{ display: "grid", gap: ".5rem" }}>
      {threads.length === 0 && <p className="sub">Nenhuma conversa privada ainda. Alunos podem iniciar uma DM a partir do curso.</p>}
      {threads.map((t) => (
        <button key={t.id} className="bm-row" onClick={() => setOpen({ id: t.id, who: t.student })}>
          <span className="thumb">💬</span>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div style={{ fontWeight: 620 }}>{t.student}</div>
            <div className="bm-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.course_title} · {t.last_body ?? "sem mensagens"}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Vista de thread reaproveitável (staff): envia sem child_id (a API identifica o staff pela sessão).
function ThreadView({ threadId, who, onBack }: { threadId: string; who: string; onBack: () => void }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try { setMsgs((await api.chatThreadMsgs(threadId, "")).messages); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }, [threadId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [msgs]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    try { await api.chatThreadSend(threadId, "", body); await load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Erro ao enviar."); setText(body); }
  }

  return (
    <div style={{ display: "grid", gap: ".6rem" }}>
      <button className="bm-btn-quiet bm-btn-sm" onClick={onBack} style={{ justifySelf: "start" }}>← Conversas</button>
      <div className="bm-eyebrow">Conversa privada com {who}</div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="bm-card" style={{ padding: ".8rem", height: "min(48vh, 420px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: ".5rem" }} ref={boxRef}>
        {msgs.length === 0 && <p className="sub" style={{ margin: "auto" }}>Envie a primeira mensagem.</p>}
        {msgs.map((m) => {
          const mine = !!m.sender_parent_id;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              <div className="bm-card-flat" style={{ padding: ".5rem .75rem", background: mine ? "color-mix(in srgb,var(--bm-primary) 12%,transparent)" : "var(--bm-surface-2)", borderRadius: 12 }}>{m.body}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: ".5rem" }}>
        <input className="bm-input" placeholder="Mensagem…" value={text} maxLength={1000}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="bm-btn" onClick={send} disabled={!text.trim()}>Enviar</button>
      </div>
    </div>
  );
}
