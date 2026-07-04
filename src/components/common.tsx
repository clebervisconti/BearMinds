import type { ReactNode } from "react";

// Avatar com iniciais + cor determinística por nome (padrão das plataformas de referência).
const AV_COLORS = ["#3949ab", "#12805c", "#b54708", "#9f1239", "#0e7490", "#6d28d9", "#a16207", "#be185d"];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AV_COLORS[h % AV_COLORS.length];
  return (
    <span
      className="bm-avatar-i"
      style={{ width: size, height: size, fontSize: size * 0.36, ["--av-bg" as string]: bg }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

// Companheiro 🐻 (spec 07 §3): âncora de relatedness. P1 = emoji + poses por texto.
export function Mascot({ mood = "happy", message }: { mood?: "happy" | "think" | "cheer" | "calm"; message?: ReactNode }) {
  const face = { happy: "🐻", think: "🐻‍❄️", cheer: "🐻", calm: "🐻" }[mood];
  return (
    <div style={{ display: "flex", gap: ".6rem", alignItems: "flex-start" }}>
      <div style={{ fontSize: "2rem", lineHeight: 1 }} aria-hidden>
        {face}
      </div>
      {message && (
        <div
          className="bm-card"
          style={{ padding: ".6rem .8rem", background: "var(--bm-surface-2)", border: 0, flex: 1 }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export function BearLoader({ label = "Preparando sua aula…" }: { label?: string }) {
  return (
    <div style={{ display: "grid", placeItems: "center", gap: ".8rem", padding: "2rem 0", textAlign: "center" }}>
      <div className="bm-bear-bounce" style={{ fontSize: "3rem" }} aria-hidden>
        🐻
      </div>
      <p style={{ color: "var(--bm-muted)" }}>{label}</p>
      <style>{`@keyframes bmb{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}.bm-bear-bounce{animation:bmb 1s ease-in-out infinite}`}</style>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div
      style={{ height: 10, background: "var(--bm-surface-2)", borderRadius: 999, overflow: "hidden" }}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          height: "100%",
          background: "var(--bm-accent)",
          transition: "width .3s",
        }}
      />
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="bm-card"
      style={{ borderColor: "var(--bm-danger)", color: "var(--bm-danger)", background: "transparent" }}
      role="alert"
    >
      {children}
    </div>
  );
}
