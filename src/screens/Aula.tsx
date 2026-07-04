import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BearLoader, ErrorNote } from "../components/common";
import { LearningExperience } from "../components/LearningExperience";
import { api, ApiError } from "../lib/api";
import { useMe, activeChild } from "../lib/queries";
import type { GenerateBundle } from "../../shared/contracts";

export function Aula() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;

  const code = params.get("code") || undefined;
  const topic = params.get("topic") || undefined;
  const lang = (params.get("lang") as "pt" | "en") || "pt";
  const itemId = params.get("item") || null; // item de curso (spec 13): concluir marca progresso
  const cursoId = params.get("curso") || null;

  const [bundle, setBundle] = useState<GenerateBundle | null>(null);
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    if (!child) return;
    let cancelled = false;
    setBundle(null);
    setErr(null);
    api
      .generate({ child_id: child.id, bncc_code: code, topic, lang })
      .then((b) => !cancelled && setBundle(b))
      .catch((e) => !cancelled && setErr(e instanceof ApiError ? { code: e.code, message: e.message } : { code: "error", message: "Erro." }));
    return () => { cancelled = true; };
  }, [child?.id, code, topic, lang]);

  if (me.isLoading || !child) return <AppShell><BearLoader label="Carregando…" /></AppShell>;

  // Skin infantil SÓ dentro da aula, e só para perfis child das bandas lúdicas (spec 12.2).
  const kidBand = child.kind === "child" && (child.age_band === "8-10" || child.age_band === "11-14");
  const skinProps = kidBand ? { "data-skin": child.age_band } : {};

  return (
    <AppShell>
      <div
        {...skinProps}
        style={
          kidBand
            ? {
                background: "var(--bm-bg)",
                color: "var(--bm-ink)",
                borderRadius: "var(--bm-radius)",
                padding: "1rem",
                fontFamily: "var(--bm-font)",
              }
            : undefined
        }
      >
        {!bundle && !err && <BearLoader label="Preparando sua aula…" />}
        {err && (
          <div style={{ display: "grid", gap: "1rem" }}>
            <ErrorNote>
              {err.code === "ai_consent_required"
                ? "A geração com IA está desativada para este perfil. O responsável pode reativar nas configurações."
                : err.code === "not_in_corpus"
                  ? "Esse tópico ainda não está no nosso material verificado."
                  : err.message}
            </ErrorNote>
            <button className="bm-btn" onClick={() => nav("/cursos")}>Escolher outro tópico</button>
          </div>
        )}
        {bundle && (
          <LearningExperience
            bundle={bundle}
            childId={child.id}
            onFinish={async () => {
              if (itemId) {
                try {
                  const r = await api.learnItemProgress(itemId, child.id, "done");
                  if (r.module_completed) alert("🎉 Missão concluída com maestria! +100 moedas");
                } catch { /* best-effort */ }
                nav(cursoId ? `/curso/${cursoId}` : "/cursos");
              } else {
                nav("/");
              }
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
