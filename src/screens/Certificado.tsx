// Verificação PÚBLICA de certificado (spec 14.5) — sem login, sem PII sensível.
// Página standalone (não usa AppShell) para poder ser compartilhada por link.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

interface Cert { code: string; issued_at: string; student: string; course_title: string; institution: string | null }

export function Certificado() {
  const { code } = useParams();
  const [cert, setCert] = useState<Cert | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    api.certVerify(code).then(setCert).catch((e) => setErr(e instanceof ApiError ? e.message : "Certificado não encontrado."));
  }, [code]);

  return (
    <div className="bm-cert-page">
      <div className="bm-cert-card">
        {err ? (
          <>
            <div style={{ fontSize: "3rem" }} aria-hidden>🔍</div>
            <h1>Certificado não encontrado</h1>
            <p className="sub">O código informado não corresponde a nenhum certificado válido.</p>
          </>
        ) : !cert ? (
          <p className="sub">Verificando…</p>
        ) : (
          <>
            <div className="bm-cert-seal" aria-hidden>🐻</div>
            <div className="bm-cert-eyebrow">Certificado verificado · BearMinds</div>
            <p className="bm-cert-intro">Certificamos que</p>
            <h1 className="bm-cert-name">{cert.student}</h1>
            <p className="bm-cert-intro">concluiu com maestria o curso</p>
            <h2 className="bm-cert-course">{cert.course_title}</h2>
            {cert.institution && <p className="sub">{cert.institution}</p>}
            <div className="bm-cert-meta">
              <span>Emitido em {new Date(cert.issued_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
              <span className="bm-cert-code">Código {cert.code}</span>
            </div>
            <div className="bm-cert-badge">✓ Conclusão baseada em domínio real (FSRS) — não em presença.</div>
          </>
        )}
        <Link to="/" className="bm-cert-home">← BearMinds</Link>
      </div>
      <style>{`
        /* CYBERSPHERE light: fundo neutro, selo Verde Ascensão, títulos Preto Neural, verde só em regra/badge. */
        .bm-cert-page{min-height:100dvh;display:grid;place-items:center;padding:1.5rem;
          font-family:"Poppins",system-ui,sans-serif;
          background:linear-gradient(160deg,#f5f5f5,#ffffff)}
        .bm-cert-card{max-width:560px;width:100%;background:#fff;border:1px solid #e2e2e2;border-radius:20px;
          padding:2.4rem 2rem;text-align:center;box-shadow:0 20px 60px rgba(30,30,30,.10);display:grid;gap:.5rem;justify-items:center;
          border-top:5px solid #28d600}
        .bm-cert-seal{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#28d600,#1faf00);
          display:grid;place-items:center;font-size:2rem;margin-bottom:.4rem}
        .bm-cert-eyebrow{font-family:"Plus Jakarta Sans Variable","Plus Jakarta Sans",sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.14em;color:#1e1e1e;text-transform:uppercase}
        .bm-cert-intro{color:#5f5f5f;margin:.3rem 0 0;font-size:.9rem}
        .bm-cert-name{font-family:"Plus Jakarta Sans Variable","Plus Jakarta Sans",sans-serif;font-size:2rem;line-height:1.1;color:#1e1e1e;margin:.1rem 0}
        .bm-cert-course{font-family:"Plus Jakarta Sans Variable","Plus Jakarta Sans",sans-serif;font-size:1.25rem;color:#1e1e1e;margin:.1rem 0;border-bottom:3px solid #28d600;display:inline-block;padding-bottom:.15rem}
        .sub{color:#5f5f5f;font-size:.9rem;margin:0}
        .bm-cert-meta{display:flex;flex-wrap:wrap;gap:.4rem 1rem;justify-content:center;margin-top:.9rem;color:#5f5f5f;font-size:.82rem}
        .bm-cert-code{font-family:ui-monospace,monospace;background:#ececec;padding:.1rem .5rem;border-radius:6px}
        .bm-cert-badge{margin-top:1rem;font-size:.82rem;color:#178000;background:#e8f9e2;padding:.5rem .8rem;border-radius:10px}
        .bm-cert-home{margin-top:1.4rem;color:#1e1e1e;text-decoration:none;font-size:.85rem}
        h1,h2{margin:0;font-family:"Plus Jakarta Sans Variable","Plus Jakarta Sans",sans-serif}
      `}</style>
    </div>
  );
}
