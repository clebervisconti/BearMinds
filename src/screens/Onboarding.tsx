// Onboarding (spec 12.1): primeiro "Quem vai estudar?" — Eu mesmo (self-consent) ou
// Meu filho(a) (gate LGPD art. 14 inalterado). Depois: instituição → perfil → disciplinas → prova.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useInstitutions, useMe } from "../lib/queries";
import { BearLoader, ErrorNote, Mascot } from "../components/common";

const CONSENT_COPY: { scope: "account" | "ai_generation" | "progress_tracking" | "email_updates"; label: string; required: boolean }[] = [
  { scope: "account", label: "Criar a conta e o perfil do meu filho (apelido, ano de nascimento e série — nada além disso).", required: true },
  { scope: "ai_generation", label: "Gerar conteúdo de estudo com IA a partir dos tópicos que meu filho escolher.", required: true },
  { scope: "progress_tracking", label: "Acompanhar o progresso de aprendizagem para agendar as revisões certas.", required: true },
  { scope: "email_updates", label: "Receber por e-mail o resumo de progresso e lembretes de prova.", required: false },
];

const nowYear = new Date().getFullYear();
type Who = "self" | "child";

export function Onboarding() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const insts = useInstitutions();

  const [who, setWho] = useState<Who | null>(null);
  const [step, setStep] = useState(0); // 0=quem, 1=consent(child), 2=instituição, 3=perfil, 4=disciplinas, 5=prova
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [consents, setConsents] = useState({ account: false, ai_generation: false, progress_tracking: false, email_updates: false });
  const [institutionId, setInstitutionId] = useState("bncc-padrao");
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [priority, setPriority] = useState<string | null>(null);
  const [prova, setProva] = useState({ title: "", date: "", subject: "" });

  const institution = insts.data?.institutions.find((i) => i.id === institutionId);
  const requiredOk = consents.account && consents.ai_generation && consents.progress_tracking;
  const selectedClass = institution?.classes.find((c) => c.id === classId);
  const hasSelf = me.data?.children.some((c) => c.kind === "self") ?? false;
  const totalSteps = who === "child" ? 6 : 5;

  const suggestedClasses = useMemo(() => {
    if (!institution || !birthYear) return institution?.classes ?? [];
    const age = nowYear - Number(birthYear);
    return [...institution.classes].sort((a, b) => Math.abs(midAge(a.age) - age) - Math.abs(midAge(b.age) - age));
  }, [institution, birthYear]);

  function nextFromWho(w: Who) {
    setWho(w);
    setStep(w === "child" ? 1 : 2);
  }

  async function finish() {
    if (!selectedClass || !who) return;
    setBusy(true);
    setErr(null);
    try {
      const base = {
        display_name: name.trim(),
        birth_year: Number(birthYear),
        grade: selectedClass.grade_equiv,
        institution_id: institutionId,
        class_id: classId,
        subjects,
        priority_subject: priority,
      };
      const meResp =
        who === "child"
          ? await api.createChild({ ...base, consents })
          : await api.createSelfProfile(base);
      qc.setQueryData(["me"], meResp);
      const childId = meResp.active_child_id ?? meResp.children[meResp.children.length - 1]?.id;

      if (prova.title && prova.date && prova.subject && childId) {
        try {
          const tree = await api.tree({ institution: institutionId, class: classId, subject: prova.subject });
          const codes = tree.topics.map((t) => t.bncc_code);
          if (codes.length) {
            await api.createProva({ child_id: childId, title: prova.title, subject_id: prova.subject, exam_date: prova.date, bncc_codes: codes });
          }
        } catch { /* prova é opcional */ }
      }
      nav("/");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao concluir.");
    } finally {
      setBusy(false);
    }
  }

  if (insts.isLoading || me.isLoading) return <BearLoader label="Carregando…" />;

  return (
    <div className="bm-shell" style={{ maxWidth: 540, display: "grid", gap: "1rem", alignContent: "start" }}>
      <StepDots step={who === "child" ? step : Math.max(0, step - 1)} total={totalSteps} />

      {/* ---- 0 · Quem vai estudar? ---- */}
      {step === 0 && (
        <section style={{ display: "grid", gap: ".8rem" }}>
          <h2>Quem vai estudar?</h2>
          <p style={{ color: "var(--bm-muted)", margin: 0 }}>
            Você pode criar um perfil para você e/ou para seus filhos — todos na mesma conta.
          </p>
          {!hasSelf && (
            <button className="bm-card" onClick={() => nextFromWho("self")} style={{ textAlign: "left", cursor: "pointer" }}>
              <strong>🎓 Eu mesmo</strong>
              <div style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>
                Sou estudante e quero estudar na plataforma (6 a 19 anos).
              </div>
            </button>
          )}
          <button className="bm-card" onClick={() => nextFromWho("child")} style={{ textAlign: "left", cursor: "pointer" }}>
            <strong>🐻 Meu filho(a)</strong>
            <div style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>
              Sou responsável e vou autorizar e acompanhar o uso.
            </div>
          </button>
          {me.data && me.data.children.length > 0 && (
            <button className="bm-btn bm-btn-ghost" onClick={() => nav("/")}>← Voltar ao início</button>
          )}
        </section>
      )}

      {/* ---- 1 · Consentimento LGPD (só filho) ---- */}
      {step === 1 && who === "child" && (
        <section style={{ display: "grid", gap: ".8rem" }}>
          <h2>Consentimento (você decide)</h2>
          <Mascot message="Marque o que você autoriza. Você pode mudar qualquer item depois, nas configurações. Nada é pré-marcado." />
          {CONSENT_COPY.map((c) => (
            <label key={c.scope} className="bm-card" style={{ display: "flex", gap: ".6rem", alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consents[c.scope]}
                onChange={(e) => setConsents((s) => ({ ...s, [c.scope]: e.target.checked }))}
                style={{ marginTop: 3, width: 20, height: 20 }}
              />
              <span>
                {c.label} {c.required && <em style={{ color: "var(--bm-muted)" }}>(necessário)</em>}
              </span>
            </label>
          ))}
          <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!requiredOk} nextLabel={requiredOk ? "Continuar" : "Marque os itens necessários"} />
        </section>
      )}

      {/* ---- 2 · Instituição ---- */}
      {step === 2 && (
        <section style={{ display: "grid", gap: ".8rem" }}>
          <h2>Qual é a escola?</h2>
          {insts.data!.institutions.map((i) => (
            <button
              key={i.id}
              className="bm-card"
              onClick={() => { setInstitutionId(i.id); setClassId(""); setSubjects([]); setPriority(null); }}
              style={{ textAlign: "left", cursor: "pointer", borderColor: institutionId === i.id ? "var(--bm-primary)" : undefined, borderWidth: institutionId === i.id ? 2 : 1 }}
            >
              <strong>{i.name}</strong>
              <div style={{ color: "var(--bm-muted)", fontSize: ".85rem" }}>
                {i.kind === "default" ? "Currículo nacional (BNCC) — a maioria das escolas" : "Rede de ensino"}
              </div>
            </button>
          ))}
          <Nav onBack={() => setStep(who === "child" ? 1 : 0)} onNext={() => setStep(3)} />
        </section>
      )}

      {/* ---- 3 · Perfil ---- */}
      {step === 3 && (
        <section style={{ display: "grid", gap: ".8rem" }}>
          <h2>{who === "self" ? "Sobre você" : "Sobre quem vai estudar"}</h2>
          {who === "self" && (
            <p style={{ color: "var(--bm-muted)", margin: 0, fontSize: ".85rem" }}>
              Guardamos só o essencial: apelido, ano de nascimento e série. Ao continuar, você concorda em usar a IA
              para gerar conteúdo de estudo e acompanhar seu progresso.
            </p>
          )}
          <label>Apelido<input className="bm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={who === "self" ? "Como quer ser chamado?" : "Como podemos chamar?"} maxLength={40} /></label>
          <label>Ano de nascimento
            <input className="bm-input" type="number" min={nowYear - 19} max={nowYear - 6} value={birthYear} onChange={(e) => setBirthYear(e.target.value ? Number(e.target.value) : "")} placeholder="Ex.: 2010" />
          </label>
          <div>
            <div style={{ marginBottom: ".4rem" }}>Turma / série</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
              {suggestedClasses.map((cl) => (
                <button key={cl.id} className="bm-btn bm-btn-ghost" onClick={() => setClassId(cl.id)} style={{ outline: classId === cl.id ? "2px solid var(--bm-primary)" : undefined }}>
                  {cl.label}
                </button>
              ))}
            </div>
          </div>
          <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!name.trim() || !birthYear || !classId} />
        </section>
      )}

      {/* ---- 4 · Disciplinas ---- */}
      {step === 4 && (
        <section style={{ display: "grid", gap: ".8rem" }}>
          <h2>Em quais matérias {who === "self" ? "quer" : "posso"} ajudar?</h2>
          <p style={{ color: "var(--bm-muted)", margin: 0 }}>Escolha uma ou mais. Toque na estrela para marcar a prioridade.</p>
          {institution?.subjects.map((s) => {
            const on = subjects.includes(s.id);
            return (
              <div key={s.id} className="bm-card" style={{ display: "flex", alignItems: "center", gap: ".6rem", borderColor: on ? "var(--bm-primary)" : undefined }}>
                <button className="bm-btn bm-btn-ghost" style={{ flex: 1, justifyContent: "flex-start" }} onClick={() => setSubjects((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}>
                  {s.icon} {s.label} {on ? "✓" : ""}
                </button>
                {on && (
                  <button aria-label="prioridade" onClick={() => setPriority(s.id)} className="bm-btn bm-btn-ghost" style={{ minWidth: 44 }}>
                    {priority === s.id ? "⭐" : "☆"}
                  </button>
                )}
              </div>
            );
          })}
          <Nav onBack={() => setStep(3)} onNext={() => setStep(5)} nextDisabled={subjects.length === 0} />
        </section>
      )}

      {/* ---- 5 · Prova (opcional) ---- */}
      {step === 5 && (
        <section style={{ display: "grid", gap: ".8rem" }}>
          <h2>Tem prova chegando? (opcional)</h2>
          <p style={{ color: "var(--bm-muted)", margin: 0 }}>
            Com a data, as revisões passam a mirar o dia certo — o conteúdo chega fresco na prova.
          </p>
          <label>Matéria
            <select className="bm-input" value={prova.subject} onChange={(e) => setProva((p) => ({ ...p, subject: e.target.value }))}>
              <option value="">—</option>
              {subjects.map((sid) => {
                const s = institution?.subjects.find((x) => x.id === sid);
                return <option key={sid} value={sid}>{s?.label ?? sid}</option>;
              })}
            </select>
          </label>
          <label>Título<input className="bm-input" value={prova.title} onChange={(e) => setProva((p) => ({ ...p, title: e.target.value }))} placeholder="Ex.: Prova de Matemática" /></label>
          <label>Data<input className="bm-input" type="date" value={prova.date} onChange={(e) => setProva((p) => ({ ...p, date: e.target.value }))} /></label>
          {err && <ErrorNote>{err}</ErrorNote>}
          <div style={{ display: "flex", gap: ".5rem" }}>
            <button className="bm-btn bm-btn-ghost" onClick={() => setStep(4)}>Voltar</button>
            <button className="bm-btn" style={{ flex: 1 }} disabled={busy} onClick={finish}>
              {busy ? "Concluindo…" : "Concluir e começar"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Nav({ onBack, onNext, nextDisabled, nextLabel }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div style={{ display: "flex", gap: ".5rem" }}>
      <button className="bm-btn bm-btn-ghost" onClick={onBack}>Voltar</button>
      <button className="bm-btn" style={{ flex: 1 }} onClick={onNext} disabled={nextDisabled}>{nextLabel ?? "Continuar"}</button>
    </div>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: 999, background: i <= step ? "var(--bm-primary)" : "var(--bm-border)" }} />
      ))}
    </div>
  );
}

function midAge(range: string): number {
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 99;
}
