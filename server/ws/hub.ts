// Hub de pub/sub em memória (P6 — WebSockets, spec 11 roadmap). PURO/testável — sem I/O de socket aqui.
// Um processo Node só (sem cluster/Redis) — suficiente para o volume atual; documentado como limite conhecido.
type Subscriber = () => void;

class Hub {
  private channels = new Map<string, Set<Subscriber>>();

  subscribe(channel: string, fn: Subscriber): () => void {
    let set = this.channels.get(channel);
    if (!set) { set = new Set(); this.channels.set(channel, set); }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.channels.delete(channel);
    };
  }

  /** Notifica "algo mudou" no canal — os assinantes decidem o que refazer (refetch via REST). */
  publish(channel: string): void {
    const set = this.channels.get(channel);
    if (!set) return;
    for (const fn of set) fn();
  }

  subscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }
}

export const hub = new Hub();
export const liveChannel = (pin: string) => `live:${pin}`;
export const chatChannel = (scope: "channel" | "thread", scopeId: string) => `chat:${scope}:${scopeId}`;
