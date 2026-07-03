import { useNavigate } from "react-router-dom";
import { BearLoader, Mascot } from "../components/common";
import { useMe, useSetActiveChild, activeChild } from "../lib/queries";

// Seletor de perfil (grade de avatares) + acesso ao modo responsável.
export function Perfis() {
  const nav = useNavigate();
  const me = useMe();
  const setActive = useSetActiveChild();

  if (me.isLoading) return <BearLoader label="Carregando…" />;
  if (!me.data) return null;

  const active = activeChild(me.data.children, me.data.active_child_id);

  return (
    <div className="bm-shell" style={{ display: "grid", gap: "1.2rem", paddingTop: "1.5rem" }}>
      <Mascot message="Quem vai estudar agora?" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: ".8rem" }}>
        {me.data.children.map((c) => (
          <button
            key={c.id}
            className="bm-card"
            onClick={() => setActive.mutate(c.id, { onSuccess: () => nav("/") })}
            style={{ display: "grid", gap: ".4rem", justifyItems: "center", cursor: "pointer", borderColor: active?.id === c.id ? "var(--bm-primary)" : undefined, borderWidth: active?.id === c.id ? 2 : 1 }}
          >
            <div style={{ fontSize: "2.4rem" }}>{c.kind === "self" ? "🎓" : "🐻"}</div>
            <strong>{c.display_name}</strong>
            <span style={{ color: "var(--bm-muted)", fontSize: ".8rem" }}>{c.grade}</span>
          </button>
        ))}
        <button className="bm-card" onClick={() => nav("/onboarding")} style={{ display: "grid", gap: ".4rem", justifyItems: "center", cursor: "pointer" }}>
          <div style={{ fontSize: "2.4rem" }}>➕</div>
          <span>Adicionar</span>
        </button>
      </div>
      <button className="bm-btn bm-btn-ghost" onClick={() => nav("/configuracoes")}>⚙ Configurações da conta</button>
    </div>
  );
}
