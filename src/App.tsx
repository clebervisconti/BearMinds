import { useEffect } from "react";
import { AppRouter } from "./router";

// Shell formal para toda a plataforma (spec 12.2). Skins infantis são aplicadas
// LOCALMENTE dentro da Aula (src/screens/Aula.tsx), nunca no <html>.
export default function App() {
  useEffect(() => {
    document.documentElement.dataset.skin = "formal";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#f6f7fb");
  }, []);

  return <AppRouter />;
}
