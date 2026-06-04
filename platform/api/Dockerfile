FROM python:3.12-slim
WORKDIR /app
COPY platform/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY platform/api/ .
ENV OTEL_SERVICE_NAME=graphrag-api
EXPOSE 8000
# auto-instrument via opentelemetry; OTLP endpoint from env
CMD ["opentelemetry-instrument", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
