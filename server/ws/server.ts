// WebSocket upgrade layer (P6 — roadmap 11): "push-to-refetch". O socket só avisa "algo mudou" no canal;
// o cliente refaz o MESMO fetch REST já testado (que já tem toda a lógica de autorização/serialização,
// incluindo esconder resposta antes do reveal em live games). Isso evita duplicar regras de negócio numa
// segunda camada — o único trabalho da WS é autenticar/autorizar a ASSINATURA e notificar.
//
// Degradação segura: se o proxy reverso de produção não repassar o upgrade de WebSocket (não verificado
// nesta sessão — ver DEPLOY.md), o cliente cai automaticamente de volta para o polling já testado
// (spec 14). Nenhuma funcionalidade quebra se a WS simplesmente não conectar.
import type { Server, IncomingMessage } from "node:http";
import type { ServerType } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "../db.ts";
import { sessionFromCookieHeader } from "../lib/session.ts";
import { hub, liveChannel, chatChannel } from "./hub.ts";
import { courseAccess, threadAccess } from "../routes/chat.ts";
import { logger } from "../logger.ts";

function reject(socket: import("node:stream").Duplex, status: number): void {
  socket.write(`HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : "Forbidden"}\r\n\r\n`);
  socket.destroy();
}

function resolveChannel(pathname: string, query: URLSearchParams, session: { parentId: string; activeChildId: string | null }): string | null {
  const parts = pathname.split("/").filter(Boolean); // ['ws', ...]
  if (parts[0] !== "ws") return null;

  if (parts[1] === "live" && parts[2]) {
    // Mesma permissividade do REST (GET /api/live/:pin/state): qualquer responsável autenticado.
    const exists = db.prepare("SELECT 1 FROM live_sessions WHERE pin = ?").get(parts[2]);
    return exists ? liveChannel(parts[2]) : null;
  }

  if (parts[1] === "chat" && parts[2] === "channel" && parts[3]) {
    const courseId = parts[3];
    const childId = query.get("child_id");
    const shim = { get: (k: "parentId" | "activeChildId") => (k === "parentId" ? session.parentId : session.activeChildId) };
    try {
      courseAccess(shim, courseId, childId);
    } catch { return null; }
    const row = db.prepare("SELECT id FROM chat_channels WHERE course_id = ?").get(courseId) as { id: string } | undefined;
    return row ? chatChannel("channel", row.id) : null; // canal ainda sem mensagens = nada a assinar
  }

  if (parts[1] === "chat" && parts[2] === "thread" && parts[3]) {
    const threadId = parts[3];
    const childId = query.get("child_id");
    try {
      threadAccess(session.parentId, session.activeChildId, threadId, childId);
    } catch { return null; }
    return chatChannel("thread", threadId);
  }

  return null;
}

// `serve()` do @hono/node-server só devolve Http2Server quando configurado explicitamente para HTTP/2
// (não é o caso aqui — sem essa opção, o retorno em runtime é sempre um http.Server plano).
export function attachWebSocketServer(serverType: ServerType): void {
  const server = serverType as Server;
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws/")) return; // não é nosso — deixa outros handlers (se houver)

    const session = sessionFromCookieHeader(req.headers.cookie);
    if (!session) return reject(socket, 401);

    const url = new URL(req.url, "http://internal");
    const channel = resolveChannel(url.pathname, url.searchParams, session);
    if (!channel) return reject(socket, 403);

    wss.handleUpgrade(req, socket, head, (ws) => {
      const unsubscribe = hub.subscribe(channel, () => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "update" }));
      });
      ws.on("close", unsubscribe);
      ws.on("error", unsubscribe);
    });
  });

  logger.info({}, "WebSocket upgrade layer anexado (/ws/live/:pin, /ws/chat/channel/:courseId, /ws/chat/thread/:id)");
}
