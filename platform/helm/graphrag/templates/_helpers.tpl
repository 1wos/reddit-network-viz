{{- define "graphrag.labels" -}}
app.kubernetes.io/part-of: graphrag
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "graphrag.commonEnv" -}}
- name: REDIS_URL
  value: {{ .Values.redis.url | quote }}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ .Values.otel.endpoint | quote }}
{{- end -}}
