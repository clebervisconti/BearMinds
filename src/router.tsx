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
import { CursoPage } from "./screens/CursoPage";
import { Admin } from "./screens/admin/Admin";
import { AdminCurso } from "./screens/admin/AdminCurso";
import { AdminPessoas } from "./screens/admin/AdminPessoas";
import { Convite } from "./screens/admin/Convite";
import { PoliticaPrivacidade, Termos } from "./screens/Legal";

// Guarda: exige titular autenticado; sem perfil → onboarding (guardião) ou /admin (staff, spec 13).
function Private({ children, needsChild = true }: { children: JSX.Element; needsChild?: boolean }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <BearLoader label="Carregando…" />;
  if (me.isError || !me.data) return <Navigate to="/entrar" replace state={{ from: loc }} />;
  if (needsChild && me.data.children.length === 0) {
    return me.data.parent.role !== "guardian"
      ? <Navigate to="/admin" replace />
      : <Navigate to="/onboarding" replace />;
  }
  return children;
}

// Área de staff: dispensa perfil de estudante.
function Staff({ children }: { children: JSX.Element }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <BearLoader label="Carregando…" />;
  if (me.isError || !me.data) return <Navigate to="/entrar" replace state={{ from: loc }} />;
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
      <Route path="/curso/:id" element={<Private><CursoPage /></Private>} />

      <Route path="/convite/:token" element={<Convite />} />
      <Route path="/admin" element={<Staff><Admin /></Staff>} />
      <Route path="/admin/curso/:id" element={<Staff><AdminCurso /></Staff>} />
      <Route path="/admin/pessoas" element={<Staff><AdminPessoas /></Staff>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
