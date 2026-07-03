import { useEffect } from "react";
import { AppRouter } from "./router";
import { useMe, activeChild } from "./lib/queries";

// Gerencia o skin por faixa etária (spec 05 §5.2): <html data-skin> = age_band do perfil ativo.
export default function App() {
  const me = useMe();
  const child = me.data ? activeChild(me.data.children, me.data.active_child_id) : null;

  useEffect(() => {
    const skin = child?.age_band ?? "11-14";
    document.documentElement.dataset.skin = skin;
    const theme = { "8-10": "#fff7ed", "11-14": "#f7f8fc", "15-18": "#0f1620" }[skin];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme);
  }, [child?.age_band]);

  return <AppRouter />;
}
