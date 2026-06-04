/**
 * GraphRAG worker — consumes jobs, continues the distributed trace started by
 * FastAPI (via job.traceparent), dispatches to the engine handlers, and lets the
 * queue handle retry/backoff/DLQ. Run: node platform/worker/worker.js
 */
import { startOtel } from "./otel.js";
startOtel(); // must init before other imports use instrumented libs

import { propagation, trace, context, SpanStatusCode } from "@opentelemetry/api";
import { RedisQueue } from "./queue.js";
import { handlers } from "./jobs.js";

const queue = new RedisQueue("graphrag", { maxRetries: 3, baseDelayMs: 500 });
const tracer = trace.getTracer("graphrag-worker");

async function handle(job) {
  // continue the upstream trace (W3C traceparent carried in the job)
  const parentCtx = job.traceparent
    ? propagation.extract(context.active(), { traceparent: job.traceparent })
    : context.active();

  await context.with(parentCtx, async () => {
    const span = tracer.startSpan(`job:${job.type}`, { attributes: { "job.id": job.id, "job.type": job.type, "job.attempts": job.attempts } });
    try {
      const handler = handlers[job.type];
      if (!handler) throw new Error(`unknown job type: ${job.type}`);
      const result = await context.with(trace.setSpan(context.active(), span), () => handler(job));
      span.setStatus({ code: SpanStatusCode.OK });
      console.log(JSON.stringify({ level: "info", job: job.type, id: job.id, result }));
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err.message) });
      span.recordException(err);
      console.error(JSON.stringify({ level: "error", job: job.type, id: job.id, attempt: job.attempts, error: String(err.message) }));
      throw err; // queue → backoff/DLQ
    } finally {
      span.end();
    }
  });
}

console.log("[graphrag-worker] consuming queue 'graphrag' …");
queue.consume(handle).catch((e) => { console.error("fatal", e); process.exit(1); });
