// App shell. As telas reais (Onboarding, Home, Lição, Quiz, Responsável…) são
// montadas no router em src/router.tsx (spec 03–08). Este arquivo só compõe o roteador.
import { AppRouter } from "./router";

export default function App() {
  return <AppRouter />;
}
