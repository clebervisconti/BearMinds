// Splunk Observability Cloud bootstrap. Import this at the absolute top of the
// server entry point (server/index.ts already does).
//
// This was previously a hand-rolled @opentelemetry/sdk-node setup. It worked, but
// it was vanilla OTel rather than the Splunk distro, so it missed the distro's
// Splunk-specific resource attributes and defaults that Splunk APM relies on to
// group services correctly. `@splunk/otel` wraps the same NodeSDK and adds them.
//
// Telemetry goes to the local OTel collector on loopback, never straight to
// Splunk — only the collector holds the ingest token. See infra/otel/.
import { start, stop } from "@splunk/otel";

// Instrumentation is ON by default. It used to be gated behind
// OTEL_ENABLED === "true" with OTEL_ENABLED=false in .env.example, which meant
// BearMinds shipped a full OTel setup that never actually ran. Every Web App is
// required to be instrumented, so the switch is now opt-OUT: set
// OTEL_ENABLED=false explicitly to disable it (useful for tests and local runs).
const otelEnabled = process.env.OTEL_ENABLED !== "false";
let started = false;

if (otelEnabled) {
  try {
    start({
      serviceName: process.env.OTEL_SERVICE_NAME || "bearminds-api",
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318",
      logLevel: process.env.OTEL_LOG_LEVEL === "debug" ? "debug" : "info",
      tracing: true,
      metrics: true,
      // Carries application logs — and, once the CIM work lands, the Apple
      // sign-in success/failure events that Security Essentials runs on.
      logging: true,
      // Off deliberately: the profiler adds real CPU overhead and nothing in
      // Splunk currently consumes BearMinds profiles.
      profiling: false,
    });
    started = true;
    // eslint-disable-next-line no-console
    console.log("⚡ Splunk OpenTelemetry started (traces + metrics + logs).");
  } catch (error) {
    // Telemetry must never take the API down.
    // eslint-disable-next-line no-console
    console.error("❌ Failed to start Splunk OpenTelemetry:", error);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!started) return;
  try {
    await stop();
    // eslint-disable-next-line no-console
    console.log("⚡ Splunk OpenTelemetry shut down gracefully.");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Error shutting down Splunk OpenTelemetry:", error);
  }
}
