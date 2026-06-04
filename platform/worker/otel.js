/**
 * OpenTelemetry init for the Node worker. Exports spans via OTLP (Tempo/Jaeger).
 * Trace context is propagated from upstream (FastAPI) through the job payload's
 * `traceparent`, so a single trace spans API → queue → worker.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

export function startOtel() {
  const sdk = new NodeSDK({
    resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "graphrag-worker" }),
    traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces" }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  process.on("SIGTERM", () => sdk.shutdown());
  return sdk;
}
