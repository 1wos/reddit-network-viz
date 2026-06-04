# Design Gap Analysis — what seocho has that this project doesn't

seocho(실제 운영되는 온톨로지 미들웨어)를 기준으로 이 프로젝트의 **설계 갭**을 정직하게
매핑한다. seocho를 *복제*하려는 게 아니라, *배운 점*으로 내 설계를 더 단단하게 만들기 위한 지도.

## 갭 매트릭스

| seocho 역량 | 무엇을 하나 | 우리 상태 | 우선순위 |
|---|---|---|---|
| **Vocabulary/alias** (`ManagedVocabularyResolver`) | 질의시 별칭→정식 엔티티 정규화 | ✅ **완료** (`src/ontology/vocab.js`) | — |
| **Ontology Control Plane** (`OntologySignal`→`OntologyProfile`→compile→select→evaluate, promote/approve) | 런이 신호 방출→리뷰가능·버전된 프로파일→에이전트가 최적 선택→baseline 대비 평가 | ❌ (기본 eval만) | **HIGH** (seocho 시그니처 lock-in) |
| **Ontology lint + Competency Questions** (ISO 704 CQ) | 온톨로지 *설계 품질* 검증(고아 노드, inverse 누락, 타입 커버리지, "이 질문들에 답할 수 있나") | ⚠️ 스키마 검증만 | **HIGH** (온톨로지 엔지니어링 rigor, 키 불필요) |
| **Parallel Debate** (`debate.py`) | 여러 에이전트가 답을 토론·합의 | ❌ | **MEDIUM-HIGH** (멀티-API 실험과 결합) |
| **Rich eval** (FinDER: token/tool-call/false-support/reasoning) | 토큰·툴콜·거짓지지 탐지까지 추적 | ⚠️ 기본 지표 | MEDIUM |
| **Ontology versioning / migration** | 온톨로지 버전·인스턴스 마이그레이션 | ❌ | MEDIUM |
| **Ontology reasoner** | 추론(subclass·transitive 등) | ❌ | MEDIUM |
| **Extraction firewall / grounding** | 환각 추출 차단 | ⚠️ 검증+grounding 규칙 | 부분 ✅ |
| **PropertyGraphLens** | 스키마리스 그래프 + 의미 오버레이 | ❌ (엄격 타입) | LOW-MEDIUM |
| **Graph DB + text-to-Cypher** | 실제 그래프DB 질의 | ❌ (인메모리) | LOW (인프라) |
| **Rule profiles / governance gates** | 룰 승급 게이트 | ❌ | LOW |

## seocho에서 배운 핵심 (우리가 이미 흡수한 것)
- "하나의 ontology contract가 ingest→graph→query→answer 전 루프 지배" → 채택 ✅
- intent→required slots→subgraph→evidence bundle→grounded answer(+missing) → 채택 ✅
- support_status로 환각 차단 → 채택 ✅ (+측정: faithfulness 98.8%)
- 별칭 정규화 → **방금 채택 ✅**

## 다음에 메우면 좋은 갭 (추천 순)

1. **Ontology lint + Competency Questions** *(키 불필요, 설계 rigor 최고)*
   온톨로지가 *잘 설계됐는지* 자동 검증: 고아 노드/끊긴 링크/inverse 누락/타입 커버리지 +
   "이 온톨로지가 답해야 할 핵심 질문(CQ) 목록을 실제로 답하는가". → ISO 704/CQ는 온톨로지 엔지니어링의 정석.
2. **Ontology Control Plane (lite)** *(seocho 시그니처)*
   매 런이 `OntologySignal`(미해결 별칭·missing slot·저신뢰·drift) 방출 → 집계된 run-profile/리포트 →
   baseline vs candidate 비교. lock-in 개념을 가볍게 재현.
3. **Parallel Debate / multi-strategy** *(멀티-API와 결합)*
   같은 질문을 N개 프로바이더/전략으로 답 → 판정·합의. 멀티-API 실험 하니스와 자연스럽게 합쳐짐.

## 정직한 결론
우리는 seocho의 *질의/grounding 사고*는 충실히 흡수했고, 이제 별칭까지 채웠다. 남은 핵심 갭은
**(1) 온톨로지 설계 자가검증(lint/CQ)** 과 **(2) 신호→프로파일 control plane**. 이 둘이 "온톨로지를
*운영*한다"의 깊이를 한 단계 더 올린다. 나머지(그래프DB·reasoner·versioning)는 인프라·연구 성격이라
포폴 임팩트 대비 비용이 커서 후순위.
