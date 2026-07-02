// Roteador do app. Placeholder mínimo — as telas reais chegam nas specs 03–08 (task #10).
import { Routes, Route, Navigate } from "react-router-dom";

function Boot() {
  return (
    <div className="bm-shell" style={{ display: "grid", placeItems: "center", gap: "1rem" }}>
      <div style={{ fontSize: "3rem" }}>🐻</div>
      <h1>BearMinds</h1>
      <p style={{ color: "var(--bm-muted)", textAlign: "center" }}>
        Seu companheiro de estudos. As telas estão sendo montadas…
      </p>
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Boot />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
