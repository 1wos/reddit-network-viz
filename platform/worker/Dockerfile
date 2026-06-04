# Build context = repo root (worker reuses the JS engine in src/ and eval/).
FROM node:20-slim
WORKDIR /app
COPY platform/worker/package.json platform/worker/
RUN cd platform/worker && npm install --omit=dev
# engine code reused by the worker
COPY src/ src/
COPY eval/ eval/
COPY platform/worker/ platform/worker/
WORKDIR /app/platform/worker
CMD ["node", "worker.js"]
