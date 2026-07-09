// Testes do hub de pub/sub em memória (P6 — WebSockets). Puro, sem socket real (isso é feito via smoke
// test manual — ver specs/CHANGELOG.md).
import { describe, it, expect } from "vitest";
import { hub, liveChannel, chatChannel } from "../server/ws/hub.ts";

describe("Hub (pub/sub em memória)", () => {
  it("publish chama todos os assinantes do canal", () => {
    let count = 0;
    const unsub1 = hub.subscribe("ch-a", () => { count++; });
    const unsub2 = hub.subscribe("ch-a", () => { count++; });
    hub.publish("ch-a");
    expect(count).toBe(2);
    unsub1(); unsub2();
  });

  it("publish em canal sem assinantes não lança erro", () => {
    expect(() => hub.publish("canal-vazio-inexistente")).not.toThrow();
  });

  it("unsubscribe remove o assinante", () => {
    let count = 0;
    const unsub = hub.subscribe("ch-b", () => { count++; });
    hub.publish("ch-b");
    unsub();
    hub.publish("ch-b");
    expect(count).toBe(1);
  });

  it("canais são isolados — publish em um não afeta outro", () => {
    let a = 0, b = 0;
    const unsubA = hub.subscribe("ch-c1", () => { a++; });
    const unsubB = hub.subscribe("ch-c2", () => { b++; });
    hub.publish("ch-c1");
    expect(a).toBe(1);
    expect(b).toBe(0);
    unsubA(); unsubB();
  });

  it("subscriberCount reflete assinantes ativos", () => {
    const unsub1 = hub.subscribe("ch-d", () => {});
    const unsub2 = hub.subscribe("ch-d", () => {});
    expect(hub.subscriberCount("ch-d")).toBe(2);
    unsub1();
    expect(hub.subscriberCount("ch-d")).toBe(1);
    unsub2();
    expect(hub.subscriberCount("ch-d")).toBe(0);
  });

  it("liveChannel/chatChannel geram chaves estáveis e distintas", () => {
    expect(liveChannel("ABC123")).toBe("live:ABC123");
    expect(chatChannel("channel", "x1")).toBe("chat:channel:x1");
    expect(chatChannel("thread", "x1")).toBe("chat:thread:x1");
    expect(chatChannel("channel", "x1")).not.toBe(chatChannel("thread", "x1"));
  });
});
