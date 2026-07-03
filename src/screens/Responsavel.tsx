import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BearLoader, ErrorNote, Mascot, Progress } from "../components/common";
import { api, ApiError, EXPORT_URL } from "../lib/api";
import { useMe, useParentSummary, useLogout, activeChild } from "../lib/queries";
import { useUI } from "../lib/store";
import type { ConsentScope } from "../../shared/contracts";

const CONSENT_LABEL: Record<ConsentScope, string> = {
  account: "Conta e perfil",
  ai_generation: "Gerar conteúdo com IA",
  progress_tracking: "Acompanhar progresso (revisões)",
  email_updates: "Resumo por e-mail",
};

export function Responsavel() {
  const { parentMode, setParentMode } = useUI();
  if (!parentMode) return <ParentGate onUnlock={() => setParentMode(true)} />;
  return <ParentDashboard />;
}

function ParentGate({ onUnlock }: { onUnlock: () => void }) {
  const [a] = useState(() => 2 + Math.floor(Math.random() * 7));
  const [b] = useState(() => 3 + Math.floor(Math.random() * 6));
  const [ans, setAns] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (Number(ans) !== a + b) {
      setErr("Resposta da conta incorreta.");
      return;
    }
    setBusy(true);
    try {
      await api.verifyPassword(pw);
      onUnlock();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Senha incorreta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bm-shell" style={{ maxWidth: 420, display: "grid", gap: "1rem", paddingTop: "2rem" }}>
      <Mascot message="Esta área é do responsável. Confirme para continuar." />
      <form onSubmit={submit} style={{ display: "grid", gap: ".8rem" }}>
        <label>Quanto é {a} + {b}?<input className="bm-input" inputMode="numeric" value={ans} onChange={(e) => setAns(e.target.value)} /></label>
        <label>Sua senha<input className="bm-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
        {err && <ErrorNote>{err}</ErrorNote>}
        <button className="bm-btn" disabled={busy}>{busy ? "Verificando…" : "Entrar no modo responsável"}</button>
      </form>
    </div>
  );
}

function ParentDashboard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const { setParentMode } = useUI();
  const logout = useLogout();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const summary = useParentSummary(child?.id ?? null);
  const [err, setErr] = useState<string | null>(null);

  if (me.isLoading || !child) return <BearLoader label="Carregando…" />;

  async function toggleConsent(scope: ConsentScope, granted: boolean) {
    if (!child) return;
    try {
      const res = await api.setConsent(child.id, scope, granted);
      if (res.deleted) { qc.clear(); nav("/entrar"); return; }
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao alterar consentimento.");
    }
  }

  async function doDelete() {
    if (!confirm("Excluir a conta e todos os dados? Esta ação inicia a exclusão definitiva.")) return;
    try {
      await api.deleteAccount();
      qc.clear();
      nav("/entrar");
    } catch { /* ignore */ }
  }

  const s = summary.data;

  return (
    <div className="bm-shell" style={{ display: "grid", gap: "1.2rem", paddingBottom: "3rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Responsável</h1>
        <button className="bm-btn bm-btn-ghost" onClick={() => { setParentMode(false); nav("/"); }}>Sair do modo</button>
      </header>

      <section>
        <h2>{child.display_name} — últimos 7 dias</h2>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          <Stat label="Dias ativos" value={s ? `${s.week.active_days}/7` : "…"} />
          <Stat label="Revisões" value={s ? String(s.week.reviews) : "…"} />
          <Stat label="Sequência" value={s ? `🔥 ${s.week.streak}` : "…"} />
        </div>
      </section>

      {s && s.provas.length > 0 && (
        <section>
          <h2>Provas</h2>
          {s.provas.map((p, i) => (
            <div key={i} className="bm-card" style={{ marginBottom: ".6rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{p.title}</strong>
                <span style={{ color: "var(--bm-muted)" }}>{p.days_left === 0 ? "hoje" : `${p.days_left} dias`}</span>
              </div>
              <p style={{ margin: ".4rem 0" }}>Prontidão: <b>{Math.round(p.readiness * 100)}%</b></p>
              <Progress value={p.readiness} />
            </div>
          ))}
        </section>
      )}

      {s && s.mastery_by_subject.length > 0 && (
        <section>
          <h2>O que ele já lembra</h2>
          {s.mastery_by_subject.map((m) => (
            <div key={m.subject_id} className="bm-card" style={{ marginBottom: ".5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{m.subject_id}</span>
                <span style={{ color: "var(--bm-muted)" }}>{m.remembered} de {m.total} pontos</span>
              </div>
              <Progress value={m.total ? m.remembered / m.total : 0} />
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>Consentimentos</h2>
        {err && <ErrorNote>{err}</ErrorNote>}
        {me.data!.consents.filter((c) => c.scope !== "account").map((c) => (
          <label key={c.scope} className="bm-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
            <span>{CONSENT_LABEL[c.scope]}</span>
            <input type="checkbox" checked={c.granted} onChange={(e) => toggleConsent(c.scope, e.target.checked)} style={{ width: 22, height: 22 }} />
          </label>
        ))}
        <p style={{ fontSize: ".8rem", color: "var(--bm-muted)" }}>
          Desativar “Gerar conteúdo com IA” ou “Acompanhar progresso” bloqueia essas funções imediatamente.
        </p>
      </section>

      <section style={{ display: "grid", gap: ".6rem" }}>
        <h2>Seus dados (LGPD)</h2>
        <a className="bm-btn bm-btn-ghost" href={EXPORT_URL} download style={{ textDecoration: "none" }}>Exportar meus dados (JSON)</a>
        <button className="bm-btn bm-btn-ghost" onClick={doDelete} style={{ color: "var(--bm-danger)", borderColor: "var(--bm-danger)" }}>Excluir conta</button>
        <button className="bm-btn bm-btn-ghost" onClick={() => logout.mutate(undefined, { onSuccess: () => nav("/entrar") })}>Sair</button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bm-card" style={{ flex: 1, minWidth: 90, textAlign: "center" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--bm-muted)", fontSize: ".8rem" }}>{label}</div>
    </div>
  );
}
