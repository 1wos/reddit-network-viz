#!/usr/bin/env bash
# One-command local Kubernetes deploy: build images → load into a kind cluster →
# helm install. Proves the Helm chart + ArgoCD-shaped manifests actually run.
#
# Prereqs (mac):  brew install kind helm   + Docker Desktop running
# Usage:          ./platform/deploy-kind.sh
set -euo pipefail
cd "$(dirname "$0")/.."           # repo root
CLUSTER=graphrag
NS=graphrag-dev
REG=ghcr.io/1wos

echo "▶ creating kind cluster (idempotent)…"
kind create cluster --name "$CLUSTER" 2>/dev/null || echo "  cluster exists"

for svc in api worker exporter; do
  echo "▶ build + load graphrag-${svc}…"
  docker build -q -t "$REG/graphrag-$svc:dev" -f "platform/$svc/Dockerfile" .
  kind load docker-image "$REG/graphrag-$svc:dev" --name "$CLUSTER"
done

echo "▶ helm install…"
helm upgrade --install graphrag platform/helm/graphrag \
  -f platform/helm/graphrag/values.yaml \
  -f platform/helm/graphrag/values-dev.yaml \
  --set image.pullPolicy=Never \
  --create-namespace -n "$NS"

echo "▶ pods:"
kubectl -n "$NS" rollout status deploy/graphrag-api --timeout=120s || true
kubectl -n "$NS" get pods

cat <<'EOF'

✅ deployed. Try it:
  kubectl -n graphrag-dev port-forward svc/graphrag-api 8000:80 &
  curl -XPOST localhost:8000/jobs/eval -d '{"payload":{}}' -H 'content-type: application/json'
  kubectl -n graphrag-dev logs -l app.kubernetes.io/name=graphrag-worker -f
Tear down:  kind delete cluster --name graphrag
EOF
