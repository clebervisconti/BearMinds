import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { ErrorNote, Mascot } from "../components/common";

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1.2rem", background: "var(--bm-bg)" }}>
      <div style={{ width: "100%", maxWidth: 430, display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".65rem", justifyContent: "center" }}>
          <img src="/logo.png" alt="BearMinds Crest" style={{ height: "48px", width: "48px", objectFit: "contain", marginRight: "4px" }} />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 750, fontSize: "1.25rem", fontFamily: "var(--bm-font-display)", letterSpacing: "-.01em", color: "var(--bm-ink)" }}>BearMinds</div>
            <div style={{ color: "var(--bm-muted)", fontSize: ".72rem", letterSpacing: ".04em" }}>plataforma de estudos · aprender, não colar</div>
          </div>
        </div>
        <div className="bm-card" style={{ padding: "1.5rem 1.4rem", display: "grid", gap: ".9rem", boxShadow: "var(--bm-shadow-lg)" }}>
          <h1 style={{ margin: 0, fontSize: "1.2rem", textAlign: "center" }}>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Entrar() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.login(email, password);
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Entrar">
      <form onSubmit={submit} style={{ display: "grid", gap: ".8rem" }}>
        <input className="bm-input" type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="bm-input" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {err && <ErrorNote>{err}</ErrorNote>}
        <button className="bm-btn" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
      <p style={{ textAlign: "center", color: "var(--bm-muted)" }}>
        Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link>
      </p>
    </AuthShell>
  );
}

export function CriarConta() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 10) {
      setErr("A senha precisa de ao menos 10 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await api.register(email, password);
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/onboarding");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao criar conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Criar sua conta">
      <Mascot message="Você é o titular da conta: pode estudar aqui e/ou criar perfis para seus filhos. Guardamos só o essencial — apelido, ano de nascimento e série." />
      <form onSubmit={submit} style={{ display: "grid", gap: ".8rem", marginTop: ".5rem" }}>
        <input className="bm-input" type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="bm-input" type="password" placeholder="Senha (mín. 10 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        {err && <ErrorNote>{err}</ErrorNote>}
        <button className="bm-btn" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</button>
      </form>
      <p style={{ textAlign: "center", color: "var(--bm-muted)" }}>
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
      <p style={{ textAlign: "center", fontSize: ".8rem", color: "var(--bm-muted)" }}>
        Ao continuar você concorda com os <Link to="/termos">Termos</Link> e a{" "}
        <Link to="/politica-de-privacidade">Política de Privacidade</Link>.
      </p>
    </AuthShell>
  );
}
