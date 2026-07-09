// Tempo real (P6 — roadmap 11): conecta a um canal de "push-to-refetch" — ao receber qualquer
// mensagem, o chamador refaz o MESMO fetch REST que já usava no polling (nenhuma lógica nova de
// parsing). Degrada graciosamente: se a WS não conectar (proxy de produção sem passthrough de
// upgrade — ver DEPLOY.md), `connected` fica `false` para sempre e o chamador deve continuar com
// o polling testado. Nunca lança, nunca quebra a tela.
import { useEffect, useRef, useState } from "react";

export function useRealtimeChannel(path: string | null, onUpdate: () => void): boolean {
  const [connected, setConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!path) { setConnected(false); return; }
    let closed = false;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}//${window.location.host}${path}`);
    } catch {
      return; // navegador sem suporte a WS (raríssimo) — fica em polling
    }
    ws.onopen = () => { if (!closed) setConnected(true); };
    ws.onmessage = () => { onUpdateRef.current(); };
    ws.onclose = () => { if (!closed) setConnected(false); };
    return () => {
      closed = true;
      setConnected(false);
      ws.close();
    };
  }, [path]);

  return connected;
}
