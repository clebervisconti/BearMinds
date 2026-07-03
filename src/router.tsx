import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useMe } from "./lib/queries";
import { BearLoader } from "./components/common";
import { Entrar, CriarConta } from "./screens/Auth";
import { Onboarding } from "./screens/Onboarding";
import { Perfis } from "./screens/Perfis";
import { Dashboard } from "./screens/Dashboard";
import { Cursos } from "./screens/Cursos";
import { Atividades } from "./screens/Atividades";
import { Comunidade } from "./screens/Comunidade";
import { Conquistas } from "./screens/Conquistas";
import { Notificacoes } from "./screens/Notificacoes";
import { Configuracoes } from "./screens/Configuracoes";
import { Mais } from "./screens/Mais";
import { Aula } from "./screens/Aula";
import { PoliticaPrivacidade, Termos } from "./screens/Legal";

// Guarda: exige titular autenticado; sem nenhum perfil → onboarding.
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

      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/cursos" element={<Private><Cursos /></Private>} />
      <Route path="/atividades" element={<Private><Atividades /></Private>} />
      <Route path="/comunidade" element={<Private><Comunidade /></Private>} />
      <Route path="/conquistas" element={<Private><Conquistas /></Private>} />
      <Route path="/notificacoes" element={<Private><Notificacoes /></Private>} />
      <Route path="/configuracoes" element={<Private><Configuracoes /></Private>} />
      <Route path="/mais" element={<Private><Mais /></Private>} />
      <Route path="/aula" element={<Private><Aula /></Private>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
