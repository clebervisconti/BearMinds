import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
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

  if (me.isLoading || !child) return <BearLoader label="Carregando…" />;

  return (
    <Layout title="Aula">
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
          <button className="bm-btn" onClick={() => nav("/estudar")}>Escolher outro tópico</button>
        </div>
      )}
      {bundle && <LearningExperience bundle={bundle} childId={child.id} onFinish={() => nav("/")} />}
    </Layout>
  );
}
