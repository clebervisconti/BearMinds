import type { Explorable as ExplorableType } from "../../shared/contracts";

// Explorável em <iframe sandbox="allow-scripts"> — sem rede, sem storage (spec 05 §5.3).
// srcDoc é conteúdo mesma-origem porém isolado pelo sandbox (sem allow-same-origin).
export function Explorable({ e }: { e: ExplorableType }) {
  const srcDoc = `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<style>body{margin:0;padding:8px;font-family:system-ui}${e.css || ""}</style>
${e.html || ""}
<script>${e.js || ""}<\/script>`;
  return (
    <section className="bm-card" style={{ marginTop: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>🔬 {e.title}</h3>
      <p style={{ color: "var(--bm-muted)" }}>{e.instruction}</p>
      <iframe
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        title={e.title}
        style={{ width: "100%", height: 260, border: "1px solid var(--bm-border)", borderRadius: "var(--bm-radius)" }}
      />
    </section>
  );
}
