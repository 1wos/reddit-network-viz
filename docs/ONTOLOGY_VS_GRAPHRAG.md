# Ontology, GraphRAG, and "Palantir-style" — what they are and how they differ

> 이 프로젝트가 왜 "팔란티어형 온톨로지 × GraphRAG"인지, 그리고 세 개념의 차이를 정확히 정리한 문서.

## 한 장 요약

| | **GraphRAG 온톨로지** | **팔란티어형 온톨로지 (Foundry)** |
|---|---|---|
| 목적 | 검색·QA 품질 — 그래프로 **답한다** | 운영·의사결정 — 그래프 **위에서 행동한다** |
| 스키마 | 느슨/emergent (LLM이 추출) | 엄격, **타입↔인스턴스 분리** |
| 핵심 구성 | 엔티티추출 → 커뮤니티 요약 → retrieval | 타입드 객체 + 링크 + **액션(write-back)** + 함수 + **lineage** |
| 답변 | LLM이 서브그래프 위에서 합성 | (답변은 부차적) 객체를 *조작* |
| 거버넌스 | 약함 | 강함 (스키마 검증·감사·권한) |
| 비유 | 잘 정리된 노트 | 조작 가능한 디지털 트윈 |

**이 프로젝트 = 두 개의 교집합:** 팔란티어식 *운영 척추*(타입·액션·lineage) 위에 GraphRAG식 *grounded 답변*을 얹음.

---

## 1. 그냥 "온톨로지"란?

도메인을 **개념(타입) + 관계 + 제약**으로 형식화한 것. "키워드 노드들"이 아니라, *"NVIDIA는 Organization이고, TSMC를 통해 공급받고, Semiconductor 토픽에 IMPACTS한다"* 처럼 **타입과 관계가 의미를 가진** 모델.

→ 우리 구현: `src/ontology/types/objectTypes.js`(11 타입), `linkTypes.js`(12 관계).

## 2. GraphRAG 온톨로지

RAG(Retrieval-Augmented Generation)의 한 갈래. 벡터 청크 대신 **지식그래프**에서 근거를 가져와 LLM이 답함. (대표: Microsoft GraphRAG)

전형적 파이프라인:
1. 문서 → **LLM이 엔티티/관계 추출** → 그래프 생성
2. **커뮤니티 탐지(Leiden) → 계층적 요약**
3. 질의 → local(이웃)+global(커뮤니티) retrieval → **LLM 합성**

특징: 온톨로지가 *느슨*하다 (스키마를 강제하지 않거나 LLM이 emergent하게 만든다). **목적은 "더 잘 답하기"** — 그래프는 답을 위한 *substrate*.

→ 우리 구현: `src/ontology/engine/`의 `intent → slots → subgraph → evidence → grounded answer(+missing/support)` 파이프라인. 이게 GraphRAG의 "질의측".

## 3. 팔란티어형 온톨로지 (Foundry Ontology)

Palantir Foundry의 핵심. 도메인을 **운영 가능한** 형태로 모델링한다. GraphRAG가 "읽기/검색"이라면 팔란티어는 "**읽기 + 쓰기 + 거버넌스**".

5대 프리미티브:
- **Object Types** — PK·프로퍼티 스키마를 가진 타입
- **Link Types** — 카디널리티/방향/링크 프로퍼티를 가진 관계
- **Action Types** — 객체/링크를 *변경*하는 write-back (kinetic 레이어) ← **시그니처**
- **Functions** — 객체 위 파생 로직
- **Lineage / Backing datasets** — 객체가 *어디서 왔는지* 추적

특징: 스키마가 *엄격*하고 **타입과 인스턴스가 분리**된다. **목적은 "그래프 위에서 행동/의사결정"** — 답변은 부차적.

→ 우리 구현: `types/actionTypes.js`(5 액션), `store/ontologyStore.js`(검증+dispatch+이력), `functions/`, `lineage.js`.

## 4. 그래서 왜 "팔란티어형 GraphRAG"인가

대부분의 GraphRAG 데모는 **액션·거버넌스·lineage가 없다** (읽기 전용 QA). 대부분의 팔란티어식 데모는 **LLM grounded 답변이 약하다** (운영 도구).

이 프로젝트는 둘을 합쳤다:
- **바닥(팔란티어식):** 타입드 온톨로지 + write-back 액션 + 스키마 검증 + lineage → *운영 척추*
- **그 위(GraphRAG식):** intent→slot→subgraph→evidence→grounded → *질의/답변*

핵심 불변식(seocho에서 차용한 아이디어): **하나의 온톨로지 contract가 ingest→graph→query→answer 전 루프를 지배**하고, 답변은 `supportStatus`로 근거를 정직하게 표기하며 *없는 것은 없다고 말한다*.

> 한 문장: **"팔란티어형 온톨로지를 substrate로 쓰는, 환각을 grounding으로 막는 GraphRAG."**

## 5. 정직한 경계 (지금 vs 풀스케일)

| 측면 | 지금 (PoC+) | 풀스케일 |
|---|---|---|
| 그래프 생성 | 손설계 (47노드) | LLM 엔티티 추출 |
| retrieval | 단어경계 + 그래프 순회 | 임베딩(벡터) + 그래프 |
| 답변 합성 | 결정론 템플릿 | LLM (프롬프트 엔지니어링) |
| 요약 | 없음 | 커뮤니티 계층 요약 |

엔진 시그니처가 `answerWithGraphRAG(store, q)` 한 줄이라, 위 4개를 끼우면 풀스케일로 승급한다.
