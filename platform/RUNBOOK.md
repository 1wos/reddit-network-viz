# Runbook — how to actually run / deploy it

Two paths. **Path A (docker-compose)** is the fastest and gives the Grafana
screenshots. **Path B (kind + Helm)** proves a real Kubernetes deploy.

---

## Path A — docker-compose (full observability, ~5 min)

**Prereq:** Docker Desktop running (`open -a Docker`, wait until it says "running").

```bash
docker compose -f platform/docker-compose.yml up --build
```

Open:
- **Grafana** → http://localhost:3000 (anonymous admin) → dashboard "GraphRAG Platform"
- API → http://localhost:8000 · Tempo/Prometheus wired into Grafana

Drive it (new terminal):
```bash
# normal jobs
curl -XPOST localhost:8000/jobs/eval   -d '{"payload":{}}' -H 'content-type: application/json'
curl -XPOST localhost:8000/jobs/answer -d '{"payload":{"question":"Why is NVIDIA trending?"}}' -H 'content-type: application/json'

# a job that fails on purpose → watch it retry (backoff) then land in the DLQ
curl -XPOST localhost:8000/jobs/ingest -d '{"payload":{"fail":true}}' -H 'content-type: application/json'
curl localhost:8000/queue/depth          # dlq climbs to 1 after 3 retries

# reprocess the dead-letter queue after a "fix"
docker compose -f platform/docker-compose.yml exec worker node reprocess.js --drain
```

### Screenshots to capture (the "I shipped this" proof)
1. Grafana dashboard — queue depth + **DLQ panel turning red**.
2. Grafana → Explore → Tempo — one trace spanning **api → worker** with the
   failed attempts (search by service `graphrag-api`).
3. Grafana → Explore → Loki — the worker error log line for the failed `job.id`.

Tear down: `docker compose -f platform/docker-compose.yml down -v`.

---

## Path B — Kubernetes (kind + Helm), the "helm install" proof

**Prereq:** `brew install kind helm` + Docker running.

```bash
./platform/deploy-kind.sh        # builds images, loads into kind, helm installs
```

You'll get `kubectl get pods` showing **redis + api + worker + exporter** Running.
That output (or `helm list`) is the screenshot proving a real cluster deploy.

```bash
kubectl -n graphrag-dev port-forward svc/graphrag-api 8000:80 &
curl -XPOST localhost:8000/jobs/eval -d '{"payload":{}}' -H 'content-type: application/json'
kubectl -n graphrag-dev get pods
```

GitOps note: the same chart is synced by [`argocd/application.yaml`](argocd/application.yaml)
(`values-dev` / `values-prod`); prod flips `redis.deploy=false` to use a managed
endpoint and uses a different ingress path — the intentional env-diff to debug.

Tear down: `kind delete cluster --name graphrag`.

---

## If something breaks
First runs often need a tiny fix (image build, a dep version, a port). Paste the
error and it's usually a one-liner. The services are small and the logs are
structured JSON, so failures point straight at the cause.
