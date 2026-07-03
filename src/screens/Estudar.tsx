import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BearLoader, ErrorNote, Mascot } from "../components/common";
import { api, ApiError } from "../lib/api";
import { useInstitutions, useMe, useTree, activeChild } from "../lib/queries";
import type { TopicCandidate } from "../../shared/contracts";

export function Estudar() {
  const nav = useNavigate();
  const me = useMe();
  const insts = useInstitutions();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;
  const institutionId = child?.institution_id ?? "bncc-padrao";
  const institution = insts.data?.institutions.find((i) => i.id === institutionId);

  const [subject, setSubject] = useState<string | null>(null);
  const [free, setFree] = useState("");
  const [candidates, setCandidates] = useState<TopicCandidate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const chosenSubjects = child?.subjects ?? [];
  const classId = child?.class_id ?? child?.grade ?? "";
  const subjLang = institution?.subjects.find((s) => s.id === subject)?.lang ?? "pt";
  const tree = useTree(subject ? { institution: institutionId, class: classId, subject } : null);

  function go(code: string) {
    nav(`/aula?code=${encodeURIComponent(code)}&lang=${subjLang}`);
  }

  async function resolveFree() {
    if (!free.trim()) return;
    setErr(null);
    setResolving(true);
    setCandidates(null);
    try {
      const res = await api.resolveTopic(free.trim(), child?.grade);
      if (res.candidates.length === 0) {
        setErr("Não encontrei esse tópico no nosso material verificado ainda. Tente outro ou escolha da lista.");
      } else if (res.candidates.length === 1) {
        go(res.candidates[0].bncc_code);
      } else {
        setCandidates(res.candidates);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao buscar o tópico.");
    } finally {
      setResolving(false);
    }
  }

  if (me.isLoading || insts.isLoading) return <BearLoader label="Carregando…" />;
  if (!child) return null;

  // Etapa 1: escolher matéria
  if (!subject) {
    return (
      <Layout title="Estudar algo novo">
        <p style={{ color: "var(--bm-muted)" }}>Escolha a matéria:</p>
        <div style={{ display: "grid", gap: ".6rem" }}>
          {institution?.subjects.map((s) => {
            const enabled = chosenSubjects.includes(s.id);
            return (
              <button
                key={s.id}
                className="bm-card"
                disabled={!enabled}
                onClick={() => setSubject(s.id)}
                style={{ textAlign: "left", opacity: enabled ? 1 : 0.5 }}
              >
                <strong>{s.icon} {s.label}</strong>
                {!enabled && <div style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>em breve</div>}
              </button>
            );
          })}
        </div>
      </Layout>
    );
  }

  // Etapa 2: escolher tópico (lista + texto livre)
  return (
    <Layout title="Escolha um tópico">
      <button className="bm-btn bm-btn-ghost" onClick={() => { setSubject(null); setCandidates(null); setErr(null); }} style={{ marginBottom: ".8rem" }}>
        ← Trocar matéria
      </button>

      <div className="bm-card" style={{ marginBottom: "1rem" }}>
        <Mascot message="Sabe o que quer estudar? Escreve aqui — ex.: “frações equivalentes”." />
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".6rem" }}>
          <input className="bm-input" value={free} onChange={(e) => setFree(e.target.value)} placeholder="Digite um tópico" onKeyDown={(e) => e.key === "Enter" && resolveFree()} />
          <button className="bm-btn" onClick={resolveFree} disabled={resolving || !free.trim()}>{resolving ? "…" : "Buscar"}</button>
        </div>
        {err && <div style={{ marginTop: ".6rem" }}><ErrorNote>{err}</ErrorNote></div>}
        {candidates && (
          <div style={{ marginTop: ".8rem" }}>
            <p style={{ margin: 0 }}>É isso que você vai estudar?</p>
            <div style={{ display: "grid", gap: ".4rem", marginTop: ".4rem" }}>
              {candidates.map((c) => (
                <button key={c.bncc_code} className="bm-btn bm-btn-ghost" style={{ justifyContent: "flex-start" }} onClick={() => go(c.bncc_code)}>
                  {c.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <h3>Tópicos da sua turma</h3>
      {tree.isLoading && <BearLoader label="Carregando tópicos…" />}
      {tree.data && tree.data.topics.length === 0 && (
        <p style={{ color: "var(--bm-muted)" }}>Ainda não há tópicos verificados para esta matéria/turma. Em breve! 🐻</p>
      )}
      <div style={{ display: "grid", gap: ".5rem" }}>
        {tree.data?.topics.map((t) => (
          <button key={t.bncc_code} className="bm-card" onClick={() => go(t.bncc_code)} style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{t.title}</span>
            <span style={{ fontSize: ".75rem", color: t.has_cache ? "var(--bm-success)" : "var(--bm-muted)" }}>
              {t.has_cache ? "pronto ⚡" : "~15 s"}
            </span>
          </button>
        ))}
      </div>
    </Layout>
  );
}
