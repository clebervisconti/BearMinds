// Aceite de convite de staff (público): /convite/:token → define senha → entra como professor/gestor.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError } from "../../lib/api";

const ROLE_LABEL: Record<string, string> = {
  professor: "Professor(a)",
  tutor: "Tutor(a)",
  institution_admin: "Gestor(a) da instituição",
  platform_admin: "Administrador(a) da plataforma",
};

export function Convite() {
  const { token } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [info, setInfo] = useState<{ email: string; role: string; institution: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.inviteInfo(token).then(setInfo).catch((e) => setErr(e instanceof ApiError ? e.message : "Convite inválido."));
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      await api.inviteAccept(token, password);
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/admin");
    } catch (er) {
      setErr(er instanceof ApiError ? er.message : "Erro ao aceitar convite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1.2rem", background: "var(--bm-bg)" }}>
      <div style={{ width: "100%", maxWidth: 440, display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".65rem", justifyContent: "center" }}>
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", fontSize: "1.4rem", background: "linear-gradient(135deg,#3949ab,#5c6bc0)" }}>🐻</span>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 750, fontSize: "1.15rem" }}>BearMinds</div>
            <div style={{ color: "var(--bm-muted)", fontSize: ".72rem" }}>convite para a equipe</div>
          </div>
        </div>
        <div className="bm-card" style={{ padding: "1.5rem 1.4rem", display: "grid", gap: ".9rem", boxShadow: "var(--bm-shadow-lg)" }}>
          {!info && !err && <BearLoader label="Verificando convite…" />}
          {err && <ErrorNote>{err}</ErrorNote>}
          {info && (
            <>
              <div style={{ textAlign: "center" }}>
                <h1 style={{ margin: 0, fontSize: "1.15rem" }}>Você foi convidado(a)! 🎉</h1>
                <p style={{ color: "var(--bm-muted)", margin: ".4rem 0 0", fontSize: ".9rem" }}>
                  <b>{ROLE_LABEL[info.role] ?? info.role}</b>
                  {info.institution ? <> em <b>{info.institution}</b></> : null}
                  <br />Conta: {info.email}
                </p>
              </div>
              <form onSubmit={accept} style={{ display: "grid", gap: ".7rem" }}>
                <input
                  className="bm-input"
                  type="password"
                  placeholder="Defina sua senha (mín. 10 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={10}
                />
                <button className="bm-btn" disabled={busy || password.length < 10}>
                  {busy ? "Entrando…" : "Aceitar convite e entrar"}
                </button>
              </form>
              <p className="bm-meta" style={{ textAlign: "center", margin: 0 }}>
                Se já tiver conta com este e-mail, use a senha dela para vincular o papel.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
