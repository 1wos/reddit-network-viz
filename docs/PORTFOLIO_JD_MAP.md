# Portfolio ↔ JD Map — how this project demonstrates each requirement

> 타깃 JD(금융 AI / LLM 플랫폼)의 각 항목을 이 프로젝트의 *구체적 구현*에 매핑한다.
> 정직 원칙: ✅ 구현됨 · 🟡 부분 · ⬜ 계획. 과장하지 않는다.

## JD 요건 → 구현 매핑

| JD 항목 | 이 프로젝트에서 | 상태 | 위치 / 계획 |
|---|---|---|---|
| **Knowledge Graph 모델링** | 타입드 온톨로지(11 객체타입·12 관계·링크 프로퍼티), 47노드 금융 그래프 | ✅ | `types/`, `mockOntologyData.js` |
| **금융 도메인** | 반도체 공급망·AI capex·매크로 rate transmission·크립토·리스크 에스컬레이션 | ✅ | `mockOntologyData.js` |
| **RAG 아키텍처 설계** | intent→slot→subgraph→evidence→grounded answer(+support/missing) | ✅ | `engine/` |
| **RAG 운영 (Vector DB·Embedding)** | 하이브리드 retrieval(어휘+벡터), pluggable VectorIndex(→pgvector/OpenSearch) | ✅ | `embeddings/`, `vector/` |
| **Contextual Embedding 기반 모델링** | 엔티티를 *온톨로지 이웃+근거와 함께* 임베딩 (KG contextual retrieval) | ✅ | `embeddings/contextualText.js` |
| **Prompt Engineering / Tuning** | grounded 답변합성 + 추출 프롬프트, 결정론↔LLM 토글 — **Kimi K2.5로 라이브 검증** | ✅ | `llm/prompts.js`·`llm/provider.js`·`scripts/llm-live.mjs` |
| **MCP / structured context 프로토콜** | 엔진을 MCP 서버로 노출(answer·lineage·neighbors·action·briefing·catalog 6툴) | ✅ | `mcp/server.js`·`mcp/tools.js` |
| **Agent Orchestration** | LangGraph extract→validate→(retry)→link→emit + MCP 툴콜 | ✅ | `services/graph-ingest/pipeline.py` |
| **LangChain / LangGraph / LlamaIndex** | Python 인제스트 서비스(LangGraph StateGraph) | ✅ | `services/graph-ingest/` |
| **AWS AI/ML 파이프라인** | Bedrock·Lambda·S3 + **IaC(CDK·Terraform)** + 컨테이너 Lambda | ✅ | `infra/cdk`·`infra/terraform`·`docs/AWS_ARCHITECTURE.md` |
| **IaC (CDK/Terraform)** *(보너스)* | 동일 스택을 CDK(TS)+Terraform 양쪽으로, container Lambda | ✅ | `infra/` |

→ 현재(M1)만으로 **KG·금융·RAG설계·grounded답변·정직성**은 이미 시연 가능. 나머지 "우대" 항목은 아래 마일스톤으로 커버.

## 마일스톤 (JD 커버리지 최대화 순서)

### ✅ M1 — 팔란티어형 온톨로지 + GraphRAG 엔진 + UI (완료)
타입/인스턴스 분리, write-back 액션, lineage, grounded 엔진(supportStatus·날조차단), 앱 연결.
→ **커버:** KG, 금융, RAG 설계, (에이전트적) 오케스트레이션 맛보기.

### ✅ M2 — MCP 서버 (구조적 컨텍스트 프로토콜) — 완료
`mcp/server.js`(@modelcontextprotocol/sdk, stdio) + `mcp/tools.js`(SDK-비의존 핸들러)로 6개 툴 노출:
`ontology_answer`·`ontology_lineage`·`ontology_neighbors`·`ontology_action`·`ontology_briefing`·`ontology_catalog`.
`scripts/mcp-smoke.mjs` ALL GREEN, 서버 stdio 부팅 확인. Claude Desktop 등 MCP 클라이언트에서 호출 가능.
→ **커버:** MCP/structured context, Agent Orchestration(툴 콜).

### ✅ M3 — Contextual Embeddings + Vector retrieval — 완료
`embeddings/`(pluggable EmbeddingProvider: 기본 HashingEmbedder, 프로덕션 MiniLM/Bedrock 어댑터) + `contextualText.js`(엔티티를 **온톨로지 이웃+근거와 함께** 임베딩) + `vector/vectorIndex.js`(코사인, →pgvector/OpenSearch 교체 가능). `queryPlanner`가 **하이브리드**: 어휘 매칭 → 미스 시 벡터 폴백(임계값으로 날조 방지). 앱 데모에 `🔎 vector` 뱃지 노출. `scripts/embeddings-smoke.mjs` ALL GREEN.
→ **커버:** Vector DB·Embedding RAG, Contextual Embedding.

### ✅ M4 — LLM 경로 (Prompt Engineering) + Bedrock — 완료
`llm/prompts.js`(grounded 답변합성 + 온톨로지제약 추출 프롬프트, 환각금지 규칙) + `llm/provider.js`(NullLLM 기본, ClaudeLLM/BedrockLLM 어댑터). `answerWithGraphRAGLLM`이 evidence bundle을 grounding 컨텍스트로 LLM 합성, **결정론↔LLM 토글**(키 없으면 결정론 폴백). `scripts/llm-smoke.mjs`(FakeLLM, 키 불필요) ALL GREEN.
→ **커버:** Prompt Engineering/Tuning, AWS(Bedrock 어댑터).

### ✅ M5 — LangGraph 인제스트 서비스 + AWS — 완료(스캐폴드)
`services/graph-ingest/`: **LangGraph StateGraph**(extract→validate→조건부retry→link→emit), 온톨로지 contract Python 미러(JS와 동일 스키마), Bedrock-first LLM, `lambda_handler.py`. `docs/AWS_ARCHITECTURE.md`(Bedrock·Lambda·S3·OpenSearch/pgvector 다이어그램+swap point).
→ **커버:** LangGraph, Agent Orchestration, AWS 파이프라인. (실행은 API키/AWS 필요 — 코드+문서 완비)

### ✅ M6 — IaC (CDK + Terraform) — 완료(스캐폴드)
`infra/cdk/`(AWS CDK v2, TypeScript: S3 + container Lambda + Bedrock IAM, teaching README) + `infra/terraform/`(동일 스택 HCL, 비교 학습용) + `services/graph-ingest/Dockerfile`(container Lambda). `cdk synth`/`terraform plan`으로 무료 검증, `deploy`로 실제 배포.
→ **커버:** AWS(IaC), DevOps. 인프라를 코드로 정의·배포 자동화 경험.

## 면접 내러티브 (한 문단)

> "키워드 네트워크 시각화를 **팔란티어형 온톨로지를 substrate로 쓰는 GraphRAG**로 발전시켰습니다.
> 도메인을 타입드 객체·관계·write-back 액션·lineage로 모델링하고(KG/거버넌스), 그 위에
> intent→slot→subgraph→evidence→grounded-answer 파이프라인을 올렸습니다. 핵심은 **환각 방지** —
> 필요한 slot이 그래프에 없으면 `unsupported`로 정직하게 표기하고 근거(소스 포스트)를 lineage로 추적합니다.
> 엔진은 MCP 툴로 노출되고, retrieval은 contextual embedding으로, 추출은 LangGraph 에이전트 파이프라인으로
> 확장되도록 설계했습니다. 도메인은 금융(반도체 공급망·매크로 전이·크립토)입니다."
