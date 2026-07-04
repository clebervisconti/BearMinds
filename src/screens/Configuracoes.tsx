// Configurações (spec 12.2) — absorve o antigo painel do responsável: conta, perfis,
// consentimentos, visibilidade no ranking, exportar/excluir dados, sair.
// Gate do responsável (senha + desafio) continua quando o perfil ativo é child.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote } from "../components/common";
import { api, ApiError, EXPORT_URL } from "../lib/api";
import { useMe, useLogout, activeChild } from "../lib/queries";
import { useUI } from "../lib/store";
import type { ConsentScope } from "../../shared/contracts";

const CONSENT_LABEL: Record<ConsentScope, string> = {
  account: "Conta e perfil",
  ai_generation: "Gerar conteúdo com IA",
  progress_tracking: "Acompanhar progresso (revisões)",
  email_updates: "Resumo por e-mail",
};

export function Configuracoes() {
  const me = useMe();
  const { parentMode, setParentMode } = useUI();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;

  if (me.isLoading) return <AppShell title="Configurações"><BearLoader label="Carregando…" /></AppShell>;
  if (!child) return null;

  // Perfil child ativo → exige o gate do responsável (spec 03 §3.4, mantido no spec 12).
  const needsGate = child.kind === "child" && !parentMode;
  return (
    <AppShell title="Configurações">
      {needsGate ? <ParentGate onUnlock={() => setParentMode(true)} /> : <SettingsBody />}
    </AppShell>
  );
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
    } catch (er) {
      setErr(er instanceof ApiError ? er.message : "Senha incorreta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bm-card" style={{ maxWidth: 420, display: "grid", gap: ".8rem" }}>
      <p style={{ margin: 0, color: "var(--bm-muted)" }}>
        Esta área é do responsável pela conta. Confirme para continuar.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: ".7rem" }}>
        <label>Quanto é {a} + {b}?<input className="bm-input" inputMode="numeric" value={ans} onChange={(e) => setAns(e.target.value)} /></label>
        <label>Senha da conta<input className="bm-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
        {err && <ErrorNote>{err}</ErrorNote>}
        <button className="bm-btn" disabled={busy}>{busy ? "Verificando…" : "Confirmar"}</button>
      </form>
    </div>
  );
}

function SettingsBody() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const logout = useLogout();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const [err, setErr] = useState<string | null>(null);
  if (!me.data || !child) return null;

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

  async function toggleLeaderboard(hidden: boolean) {
    if (!child) return;
    try {
      const updated = await api.setLeaderboardVisibility(child.id, hidden);
      qc.setQueryData(["me"], updated);
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao atualizar visibilidade.");
    }
  }

  async function doDelete() {
    if (!confirm("Excluir a conta e todos os dados? Esta ação inicia a exclusão definitiva (30 dias).")) return;
    try {
      await api.deleteAccount();
      qc.clear();
      nav("/entrar");
    } catch { /* ignore */ }
  }

  const hasSelf = me.data.children.some((c) => c.kind === "self");

  return (
    <div style={{ display: "grid", gap: "1.1rem", maxWidth: 640 }}>
      {err && <ErrorNote>{err}</ErrorNote>}

      <section className="bm-card">
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Conta</h2>
        <p style={{ color: "var(--bm-muted)", margin: 0 }}>{me.data.parent.email}</p>
      </section>

      <section className="bm-card">
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Perfis de estudante</h2>
        <div style={{ display: "grid", gap: ".4rem" }}>
          {me.data.children.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".92rem" }}>
              <span>{c.kind === "self" ? "🎓" : "🐻"} {c.display_name} <em style={{ color: "var(--bm-muted)", fontStyle: "normal" }}>· {c.grade}</em></span>
              {c.id === child.id && <span style={{ color: "var(--bm-link)", fontWeight: 600 }}>ativo</span>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".8rem", flexWrap: "wrap" }}>
          <button className="bm-btn bm-btn-ghost" onClick={() => nav("/perfis")}>Trocar perfil</button>
          <button className="bm-btn bm-btn-ghost" onClick={() => nav("/onboarding")}>+ Adicionar perfil{!hasSelf ? " (ou o seu)" : ""}</button>
        </div>
      </section>

      <section className="bm-card">
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Consentimentos — {child.display_name}</h2>
        {me.data.consents.filter((c) => c.scope !== "account").map((c) => (
          <label key={c.scope} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".45rem 0", borderBottom: "1px solid var(--bm-border)" }}>
            <span style={{ fontSize: ".92rem" }}>{CONSENT_LABEL[c.scope]}</span>
            <input type="checkbox" checked={c.granted} onChange={(e) => toggleConsent(c.scope, e.target.checked)} style={{ width: 20, height: 20 }} />
          </label>
        ))}
        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".45rem 0" }}>
          <span style={{ fontSize: ".92rem" }}>Aparecer no ranking da instituição</span>
          <input type="checkbox" checked={!child.leaderboard_hidden} onChange={(e) => toggleLeaderboard(!e.target.checked)} style={{ width: 20, height: 20 }} />
        </label>
      </section>

      <section className="bm-card" style={{ display: "grid", gap: ".6rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Seus dados (LGPD)</h2>
        <a className="bm-btn bm-btn-ghost" href={EXPORT_URL} download style={{ textDecoration: "none" }}>Exportar meus dados (JSON)</a>
        <button className="bm-btn bm-btn-ghost" onClick={doDelete} style={{ color: "var(--bm-danger)", borderColor: "var(--bm-danger)" }}>Excluir conta</button>
        <button className="bm-btn bm-btn-ghost" onClick={() => logout.mutate(undefined, { onSuccess: () => nav("/entrar") })}>Sair da conta</button>
      </section>
    </div>
  );
}
