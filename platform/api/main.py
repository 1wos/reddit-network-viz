"""
FastAPI GraphRAG API gateway.

Accepts work, injects the W3C traceparent so the trace continues into the Node
worker, and enqueues jobs onto the shared Redis queue. The worker (Node) does
the actual engine work — one trace spans API → queue → worker.

  POST /jobs/{type}   enqueue (type ∈ ingest|embedding|graph_write|eval|answer)
  GET  /healthz       liveness
  GET  /readyz        readiness (redis reachable)
  GET  /queue/depth   main/delayed/dlq depths
"""
import json
import os
import time
import uuid

import redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from opentelemetry import propagate, trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

QUEUE = "q:graphrag"
ALLOWED = {"ingest", "embedding", "graph_write", "eval", "answer"}

app = FastAPI(title="GraphRAG API")
FastAPIInstrumentor.instrument_app(app)
r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
tracer = trace.get_tracer("graphrag-api")


class JobIn(BaseModel):
    payload: dict = {}
    idempotency_key: str | None = None


@app.post("/jobs/{job_type}")
def enqueue(job_type: str, body: JobIn):
    if job_type not in ALLOWED:
        raise HTTPException(400, f"unknown job type; allowed={sorted(ALLOWED)}")
    with tracer.start_as_current_span(f"enqueue:{job_type}"):
        carrier: dict = {}
        propagate.inject(carrier)  # W3C traceparent → carrier
        job = {
            "id": f"{job_type}-{uuid.uuid4().hex[:10]}",
            "type": job_type,
            "payload": body.payload,
            "idempotencyKey": body.idempotency_key,
            "traceparent": carrier.get("traceparent"),
            "attempts": 0,
            "enqueuedAt": time.time(),
        }
        r.lpush(QUEUE, json.dumps(job))
        return {"enqueued": True, "id": job["id"], "traceparent": job["traceparent"]}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    try:
        r.ping()
        return {"status": "ready"}
    except Exception as e:  # noqa
        raise HTTPException(503, f"redis unreachable: {e}")


@app.get("/queue/depth")
def depth():
    return {
        "main": r.llen(QUEUE),
        "delayed": r.zcard("q:graphrag:delayed"),
        "dlq": r.llen("q:graphrag:dlq"),
    }
