// Pessoas & convites (spec 13.1): convidar professores/tutores/gestores; instituições (platform_admin).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote } from "../../components/common";
import { api, ApiError } from "../../lib/api";
import { useMe, useInstitutions } from "../../lib/queries";

const ROLE_LABEL: Record<string, string> = {
  professor: "Professor",
  tutor: "Tutor",
  institution_admin: "Gestor da instituição",
  platform_admin: "Admin da plataforma",
};

export function AdminPessoas() {
  const nav = useNavigate();
  const me = useMe();
  const insts = useInstitutions();
  const role = me.data?.parent.role ?? "guardian";
  const [invites, setInvites] = useState<Record<string, unknown>[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [invRole, setInvRole] = useState("professor");
  const [invInst, setInvInst] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setInvites((await api.adminInvites()).invites);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao carregar.");
    }
  }
  useEffect(() => {
    if (role === "institution_admin" || role === "platform_admin") void load();
  }, [role]);

  if (me.isLoading) return <AppShell title="Pessoas"><BearLoader label="Carregando…" /></AppShell>;
  if (role !== "institution_admin" && role !== "platform_admin") {
    return <AppShell title="Pessoas"><ErrorNote>Área restrita a gestores.</ErrorNote></AppShell>;
  }

  async function invite() {
    setBusy(true);
    setErr(null);
    setLastLink(null);
    try {
      const r = await api.adminCreateInvite({
        email: email.trim(),
        role: invRole,
        institution_id: role === "platform_admin" ? invInst || null : undefined,
      });
      setLastLink(r.link);
      setEmail("");
      void load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao convidar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Pessoas & convites">
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav("/admin")} style={{ marginBottom: ".8rem" }}>← Administração</button>
      <div style={{ display: "grid", gap: "1rem", maxWidth: 700 }}>
        <section className="bm-card" style={{ display: "grid", gap: ".6rem" }}>
          <div className="bm-eyebrow">Convidar para a equipe</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: ".6rem" }}>
            <input className="bm-input" type="email" placeholder="email@escola.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="bm-input" value={invRole} onChange={(e) => setInvRole(e.target.value)}>
              <option value="professor">Professor</option>
              <option value="tutor">Tutor</option>
              {role === "platform_admin" && <option value="institution_admin">Gestor</option>}
            </select>
          </div>
          {role === "platform_admin" && (
            <select className="bm-input" value={invInst} onChange={(e) => setInvInst(e.target.value)}>
              <option value="">Instituição…</option>
              {insts.data?.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          )}
          {err && <ErrorNote>{err}</ErrorNote>}
          {lastLink && (
            <div className="bm-card-flat" style={{ padding: ".7rem", fontSize: ".85rem", wordBreak: "break-all" }}>
              ✅ Convite criado — envie este link:{" "}
              <a href={lastLink}>{lastLink}</a>{" "}
              <button className="bm-btn-quiet bm-btn-sm" onClick={() => navigator.clipboard?.writeText(lastLink)}>copiar</button>
            </div>
          )}
          <button className="bm-btn" disabled={busy || !email.includes("@")} onClick={invite} style={{ justifySelf: "start" }}>
            {busy ? "Criando…" : "Criar convite (7 dias)"}
          </button>
        </section>

        <section>
          <div className="bm-eyebrow" style={{ marginBottom: ".5rem" }}>Convites recentes</div>
          {!invites ? <BearLoader label="Carregando…" /> : invites.length === 0 ? (
            <div className="bm-meta">Nenhum convite ainda.</div>
          ) : (
            <div className="bm-card-flat" style={{ padding: 0, overflow: "hidden" }}>
              {invites.map((iv) => (
                <div key={String(iv.id)} style={{ display: "flex", gap: ".8rem", padding: ".55rem .9rem", borderBottom: "1px solid var(--bm-border)", fontSize: ".86rem", alignItems: "center" }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{String(iv.email)}</span>
                  <span className="bm-meta">{ROLE_LABEL[String(iv.role)] ?? String(iv.role)}</span>
                  <span className="bm-chip bm-chip-outline" style={{ fontSize: ".72rem", color: iv.accepted_at ? "var(--bm-success)" : "var(--bm-warn)" }}>
                    {iv.accepted_at ? "aceito" : "pendente"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
