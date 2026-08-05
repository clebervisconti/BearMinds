// CIM Authentication events for Splunk Security Essentials.
//
// WHY THIS IS AN EXPLICIT OTLP POST rather than the OTel logs SDK:
// @splunk/otel runs with logging:true, so an SDK logger would also work — but
// its delivery depends on the log-provider being correctly registered, and when
// that silently is not the case the events vanish with no error. That exact
// failure (telemetry that looks fine locally and never arrives) is what this
// whole compliance effort exists to eliminate, so the path is explicit and unit
// tested instead. Same approach as the Open WebUI auth proxy.
//
// The collector routes on the log-record attribute `cyberlabs.event`:
//   auth  -> index=cyberlabs_auth, sourcetype cyberlabs:auth (CIM Authentication)
//   other -> index=cyberlabs_app
// The Splunk side that tags this into the data model is infra/splunk/cyberlabs_cim.
//
// Fire-and-forget: a sign-in must never be delayed or failed by telemetry.

const ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
const SERVICE = process.env.OTEL_SERVICE_NAME || "bearminds-api";

export type AuthAction = "success" | "failure";

export interface AuthEvent {
  /** Authenticating identity. Absent when the failure happened before identification. */
  user?: string;
  /** Client IP. */
  src?: string;
  /** Human-readable cause — becomes CIM `signature`. */
  reason?: string;
}

const str = (v: unknown) => ({ stringValue: String(v) });

/** Build the CIM Authentication attribute set. Exported for testing. */
export function cimAuthAttributes(action: AuthAction, e: AuthEvent): Record<string, string> {
  return {
    "cyberlabs.event": "auth", // collector routes on this
    action,
    app: "bearminds",
    authentication_method: "apple",
    user: e.user || "unknown",
    src: e.src || "unknown",
    signature: e.reason || action,
  };
}

/** Build the OTLP/HTTP body. Exported for testing. */
export function buildOtlpPayload(action: AuthAction, e: AuthEvent, nowMs = Date.now()) {
  const now = String(nowMs * 1e6); // OTLP wants nanoseconds
  const attrs = cimAuthAttributes(action, e);
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: str(SERVICE) },
            { key: "deployment.environment", value: str("production") },
          ],
        },
        scopeLogs: [
          {
            scope: { name: "cyberlabs.cim-auth" },
            logRecords: [
              {
                timeUnixNano: now,
                observedTimeUnixNano: now,
                severityText: action === "success" ? "INFO" : "WARN",
                body: str(`apple sign-in ${action}`),
                attributes: Object.entries(attrs).map(([k, v]) => ({ key: k, value: str(v) })),
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Emit a CIM Authentication event. Never throws. */
export function emitAuthEvent(action: AuthAction, e: AuthEvent = {}): void {
  try {
    const p = fetch(`${ENDPOINT}/v1/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildOtlpPayload(action, e)),
    });
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* telemetry must never surface into the request path */
      });
    }
  } catch {
    /* ditto */
  }
}

/** Best-effort client IP. Behind cloudflared the real client is in CF-Connecting-IP. */
export function clientIp(headers: { get(name: string): string | undefined | null }): string {
  return (
    headers.get("cf-connecting-ip") ||
    (headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}
