# 이력서용 프로젝트 내용 — RedditPulse Ontology GraphRAG

> 복붙용. 정량 수치는 모두 실제 측정값(eval/lint/bench). 미배포 항목은 "구성/설계"로 정직하게 표기.

## 한 줄 소개 (헤더용)
키워드 네트워크 시각화를 **팔란티어형 온톨로지를 기반으로 한 GraphRAG 마켓-인텔리전스
시스템**으로 재설계 — 환각을 grounding으로 차단하고, 폴리글랏 작업 플랫폼·관측성·배포
파이프라인까지 end-to-end로 구축.

## 프로젝트 설명 (2~3줄)
금융 도메인의 소셜 신호를 **타입드 온톨로지(객체·관계·액션·lineage)** 로 모델링하고, 그
위에 **intent→slot→subgraph→evidence→grounded answer** 파이프라인을 올린 GraphRAG
시스템. 하나의 온톨로지 contract가 ingest→graph→query→answer 전 루프를 지배하며,
근거가 없으면 답을 만들어내지 않도록(no-fabrication) 설계.

## 핵심 성과 (bullet)
- 키워드 그래프를 **팔란티어형 온톨로지**로 정식화 — 11 객체타입 · 12 관계타입, write-back
  액션·스키마검증·lineage 운영 레이어 구축 (단일 contract로 거버넌스)
- **Grounded GraphRAG 엔진** 설계(intent→slot→subgraph→evidence) + 환각 차단(supportStatus =
  supported/partial/unsupported) — 골든셋 평가에서 **answer faithfulness 98.8% · no-fabrication 100%**
- **하이브리드 retrieval**(어휘 + contextual-embedding 벡터) 구현, **threshold-sweep ablation**으로
  recall↔환각 트레이드오프를 정량화해 최적 임계값 도출
- **온톨로지 lint + Competency Questions(10/10)** 자가검증 도입 — 설계 오류(잘못된 관계 타입)
  자동 검출·수정, design errors **0/0**
- **provider-agnostic LLM 레이어** — OpenAI 호환 14+ 프로바이더 추상화, Kimi K2.5로 grounded
  답변 **라이브 검증**, 결정론↔LLM 토글; 프롬프트는 Anthropic/OpenAI/Google 공식 가이드 적용
- 온톨로지를 **MCP(structured context protocol) 7개 툴**로 노출 + **LangGraph** 추출 파이프라인
  (extract→validate→retry→link) 으로 에이전트 오케스트레이션
- **폴리글랏 작업 플랫폼**(FastAPI · Node.js worker · Go exporter) + **Redis 큐**(지수 백오프 ·
  dead-letter · idempotency) + **OpenTelemetry 분산 트레이싱**(API→worker) 으로 실패 job 원인 추적;
  Prometheus · Grafana · Loki · Tempo 관측성
- **CI/CD·IaC** — GitHub Actions 8-게이트 품질 자동화(smoke·lint·eval), **Helm 차트(dev/prod)
  + ArgoCD GitOps**, **Terraform 멀티클라우드 IaC(AWS·GCP·Azure, 3개 validate 통과)** 구성 (kind 클러스터에 helm install 검증 완료)

## 기술 스택
React · D3 · Node.js · Python(FastAPI · LangGraph) · Go · Redis · OpenTelemetry ·
Prometheus/Grafana/Loki/Tempo · Docker · Kubernetes/Helm · ArgoCD · AWS · Terraform ·
MCP · Vector retrieval(contextual embeddings) · GitHub Actions

## 면접 방어 포인트 (외워둘 것)
- "왜 팔란티어형?" → 그래프에 *행동(액션)·검증·lineage*를 더해 운영 가능하게.
- "환각 어떻게 막았나?" → 필수 slot 미충족·앵커 미해소 시 unsupported, 프롬프트에 근거-외-금지
  규칙을 구조적으로 주입; faithfulness/no-fab를 골든셋으로 *측정*.
- "확장성?" → 현재 O(L)/O(N), 인접 인덱스·ANN(pgvector) 스왑 지점 명시; 임베딩은 Hashing→API
  교체로 recall 향상(어댑터 완비).
- 정직한 한계: 라이브 배포는 코드·차트 완비, 실제 클러스터 구동은 데모 예정.

---
> EN 버전, 또는 그룹바이 JD 맞춤 리타게팅 원하면 말해줘.
