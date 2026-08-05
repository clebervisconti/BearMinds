import { describe, it, expect } from "vitest";
import { cimAuthAttributes, buildOtlpPayload, clientIp } from "../server/lib/cim-auth.ts";

describe("CIM Authentication events", () => {
  it("carries the fields the Authentication data model needs", () => {
    const a = cimAuthAttributes("failure", { user: "x@y.z", src: "1.2.3.4", reason: "not in allowlist" });
    // The collector routes on this attribute; without it the event lands in
    // cyberlabs_app and Security Essentials never sees it.
    expect(a["cyberlabs.event"]).toBe("auth");
    expect(a.action).toBe("failure");
    expect(a.app).toBe("bearminds");
    expect(a.user).toBe("x@y.z");
    expect(a.src).toBe("1.2.3.4");
    expect(a.signature).toBe("not in allowlist");
    expect(a.authentication_method).toBe("apple");
  });

  it("degrades unknown identity to 'unknown' rather than undefined", () => {
    const a = cimAuthAttributes("failure", {});
    expect(a.user).toBe("unknown");
    expect(a.src).toBe("unknown");
  });

  it("uses only the CIM action vocabulary", () => {
    expect(cimAuthAttributes("success", {}).action).toBe("success");
    expect(cimAuthAttributes("failure", {}).action).toBe("failure");
  });

  it("builds a well-formed OTLP log payload", () => {
    const p = buildOtlpPayload("success", { user: "a@b.c" }, 1_700_000_000_000);
    const rec = p.resourceLogs[0].scopeLogs[0].logRecords[0];
    expect(rec.timeUnixNano).toBe("1700000000000000000"); // ns, not ms
    expect(rec.severityText).toBe("INFO");
    expect(rec.body.stringValue).toBe("apple sign-in success");
    const attrs = Object.fromEntries(rec.attributes.map((a) => [a.key, a.value.stringValue]));
    expect(attrs["cyberlabs.event"]).toBe("auth");
    expect(attrs.user).toBe("a@b.c");
  });

  it("marks failures at WARN so they stand out from routine sign-ins", () => {
    expect(buildOtlpPayload("failure", {}).resourceLogs[0].scopeLogs[0].logRecords[0].severityText).toBe("WARN");
  });

  it("prefers CF-Connecting-IP, since the app sits behind cloudflared", () => {
    const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });
    expect(clientIp(h({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
