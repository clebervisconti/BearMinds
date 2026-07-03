import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useMe, activeChild } from "./lib/queries";
import { BearLoader } from "./components/common";
import { Entrar, CriarConta } from "./screens/Auth";
import { Onboarding } from "./screens/Onboarding";
import { Perfis } from "./screens/Perfis";
import { Home } from "./screens/Home";
import { Estudar } from "./screens/Estudar";
import { Aula } from "./screens/Aula";
import { Responsavel } from "./screens/Responsavel";
import { PoliticaPrivacidade, Termos } from "./screens/Legal";

// Guarda: exige responsável autenticado; sem filho → onboarding.
function Private({ children, needsChild = true }: { children: JSX.Element; needsChild?: boolean }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <BearLoader label="Carregando…" />;
  if (me.isError || !me.data) return <Navigate to="/entrar" replace state={{ from: loc }} />;
  if (needsChild && me.data.children.length === 0) return <Navigate to="/onboarding" replace />;
  return children;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/criar-conta" element={<CriarConta />} />
      <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
      <Route path="/termos" element={<Termos />} />

      <Route path="/onboarding" element={<Private needsChild={false}><Onboarding /></Private>} />
      <Route path="/perfis" element={<Private><Perfis /></Private>} />
      <Route path="/" element={<Private><Home /></Private>} />
      <Route path="/estudar" element={<Private><Estudar /></Private>} />
      <Route path="/aula" element={<Private><Aula /></Private>} />
      <Route path="/responsavel" element={<Private><Responsavel /></Private>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
