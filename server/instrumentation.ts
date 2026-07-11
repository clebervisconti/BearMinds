// OpenTelemetry SDK bootstrap. Import this at the absolute top of the server entry point.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

const otelEnabled = process.env.OTEL_ENABLED === "true";
let sdk: NodeSDK | null = null;

if (otelEnabled) {
  const level = process.env.OTEL_LOG_LEVEL === "debug" ? DiagLogLevel.DEBUG : DiagLogLevel.INFO;
  diag.setLogger(new DiagConsoleLogger(), level);

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
  
  // Splunk Observability or custom OTLP headers
  const headers: Record<string, string> = {};
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    for (const pair of process.env.OTEL_EXPORTER_OTLP_HEADERS.split(",")) {
      const [key, val] = pair.split("=");
      if (key && val) headers[key.trim()] = val.trim();
    }
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
    headers,
  });

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "bearminds-api",
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable heavy or unused instrumentation to save CPU/Memory
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log("⚡ OpenTelemetry NodeSDK started successfully.");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to start OpenTelemetry SDK:", error);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      // eslint-disable-next-line no-console
      console.log("⚡ OpenTelemetry NodeSDK shut down gracefully.");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("❌ Error shutting down OpenTelemetry SDK:", error);
    }
  }
}
