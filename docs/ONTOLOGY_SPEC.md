# RedditPulse — Palantir-style Ontology Spec (WIP)

> 우리가 같이 잡아나가는 살아있는 설계 문서. "라이트"를 졸업하고 Foundry급으로 가기 위한 기준.

**확정된 결정:** 🇺🇸 미국 시장 유지 (NVIDIA/Fed/BTC) · 공시=SEC EDGAR · 시세=Finnhub/AlphaVantage · DART는 한국 확장 시 후속. 진행 순서 = 스펙 정밀화 → Phase 1 코드.

## 0. 팔란티어 온톨로지 7대 프리미티브 → 현재 vs 목표

| Foundry 프리미티브 | 지금 (MVP) | 목표 (Palantir-faithful) |
|---|---|---|
| **Object Types** (스키마 가진 타입) | 색/모양 메타만 | 프로퍼티 스키마 + PK + title 정의 |
| **Properties** (타입드 필드) | 자유 객체 | 타입·제약·enum 정의 |
| **Link Types** (카디널리티 가진 관계) | 문자열 type만 | endpoint 타입 + 카디널리티 + inverse + 링크 프로퍼티 |
| **Action Types** (write-back/kinetic) | ❌ 없음 | 파라미터 + 검증 + apply(reducer) |
| **Functions** (파생 로직) | 엔진에 섞임 | object type별 등록된 순수 함수 |
| **Backing dataset / Lineage** | evidence 스니펫 | object→source post→ingestion 추적 |
| **Type ↔ Instance 분리** | 인스턴스가 곧 스키마 | 타입 레지스트리 vs 인스턴스 스토어 분리 |

핵심 = **Action 레이어(kinetic)** 와 **Type/Instance 분리**. 이 둘이 "팔란티어형"의 정체성.

---

## 1. Object Types — 완성된 프로퍼티 스키마 (코딩 가능)

프로퍼티 타입: `string · int · double · bool · timestamp · enum · array · ref`.
모든 인스턴스 공통 시스템 필드: `__type · __pk · __backingDataset · __sourceRefs[] · __ingestedAt`.

```text
■ Entity (abstract base) — Organization·Product·Person·AssetOrTicker 가 상속
  id            string    required, pk
  label         string    required  (titleProp)
  frequency     int       default 0          — 멘션 수
  sentiment     double    [-1,1]             — MENTIONS 링크 집계 (Function)
  confidence    double    [0,1]
  trend         array<int> len 7              — 최근 7일 멘션량
  shortSummary  string
  sourceSubreddits array<string>

■ Organization  (base Entity)
  ticker        string                        — 있으면 AssetOrTicker와 연결
  domain        string                        — 로고/식별
  sector        enum[tech|finance|energy|consumer|health|other]

■ Product  (base Entity)
  maker         ref→Organization

■ Person  (base Entity)
  role          string
  affiliation   ref→Organization

■ AssetOrTicker  (base Entity)
  ticker        string    required
  assetClass    enum[equity|crypto|etf|commodity|fx]   required
  price         double                        ← 시세 API
  changePct     double                        ← 시세 API (당일 %)
  volatility    double                        ← 시세 API (실현변동성)

■ Topic  (독립)
  id            string    required, pk
  label         string    required (title)
  category      enum[macro|markets|crypto|ai|policy|other]
  frequency / sentiment / confidence / trend / shortSummary / sourceSubreddits  (Entity와 동일)

■ Subreddit
  name          string    required, pk (title)
  category      enum[finance|technology|worldnews|science|gaming|other]
  subscribers   int
  communitySentiment double [-1,1]            — Function

■ Author
  username      string    required, pk (title)
  karma         int
  accountAgeDays int

■ RedditPost  (그래프의 원천 객체)
  id            string    required, pk
  title         string    required (title)
  body          string
  score         int
  numComments   int
  createdAt     timestamp
  url           string
  sentiment     double    [-1,1]
  (links: POSTED_IN→Subreddit, AUTHORED_BY→Author, MENTIONS→Entity|Topic)

■ Event
  id            string    required, pk
  label         string    required (title)
  eventType     enum[earnings|fomc|disclosure|product|macro]   required
  scheduledAt   timestamp
  status        enum[upcoming|live|past]      default upcoming
  confidence    double    [0,1]
  sourceSubreddits array<string>              ← disclosure 는 SEC EDGAR

■ Signal (abstract base) — SentimentSignal·RiskSignal 상속
  id            string    required, pk
  label         string    required (title)
  magnitude     double    [0,1]    required
  confidence    double    [0,1]
  status        enum[open|ack|closed]  default open   ← Action 으로 전이
  evidenceCount int
  createdAt     timestamp
  sourceSubreddits array<string>

■ SentimentSignal  (base Signal)
  direction     enum[positive|negative]  required
  delta         double                        — 감성 변화폭

■ RiskSignal  (base Signal)
  horizon       enum[near|mid|long]
  riskType      enum[market|credit|liquidity|concentration|macro]  required
```

→ 이 표가 §10의 `properties:{}` 정의로 1:1 변환됨. **이걸로 §1 확정.** 빠진/바꿀 프로퍼티만 말해줘.

## 2. Link Types (카디널리티 + endpoint + inverse + 링크 프로퍼티)

```
POSTED_IN        RedditPost  →(N:1)→ Subreddit       inverse HAS_POSTS
AUTHORED_BY      RedditPost  →(N:1)→ Author          inverse AUTHORED
MENTIONS         RedditPost  →(N:M)→ Entity|Topic    inverse MENTIONED_IN   link props {weight, sentiment}
DISCUSSED_IN     Topic       →(N:M)→ Subreddit
CO_OCCURS_WITH   Entity      ↔(N:M)  Entity          symmetric             link props {count, pmi}
RELATED_TO_EVENT Entity      →(N:M)→ Event
IMPACTS          Entity      →(N:M)→ Entity|Signal   link props {polarity, strength}
ESCALATES        Signal      →(N:M)→ Signal
CONTRADICTS      Signal      ↔(N:M)  Signal
TRENDING_WITH    Entity      ↔(N:M)  Entity
EVIDENCED_BY     Signal|Entity →(N:M)→ RedditPost    ← 라인리지 링크 (근거 = 소스 객체)
```

`EVIDENCED_BY → RedditPost` 가 lineage의 핵심. 시그널/엔티티가 *어떤 실제 글*에서 나왔는지 그래프로 추적됨.

## 3. Action Types (kinetic / write-back) — **팔란티어 시그니처**

각 Action = `{ apiName, label, params, validate(store, params), apply(store, params) → newStore, sideEffects }`

```
acknowledgeSignal(signalId)              status open→ack, 기록 actor/시각
escalateRisk(signalId, targetSignalId?)  ESCALATES 링크 생성/강화, magnitude↑
createWatchlist(name)                    Watchlist 객체 생성
addToWatchlist(entityId, watchlistId)    링크 추가
linkPostToEntity(postId, entityId, w)    MENTIONS 수동 큐레이션
mergeEntities(srcId, dstId)              엔티티 해소(중복 병합) + 링크 리라우팅
annotateEvidence(signalId, postId, note) EVIDENCED_BY 링크 + 노트
```

→ UI에서 노드 우클릭/패널 버튼으로 실행 → in-memory 온톨로지 상태가 **실제로 바뀜**(write-back 시뮬레이션). 이게 "차트"를 "운영 도구"로 만드는 지점.

## 4. Functions (object type별 파생 로직, 순수)

```
Entity.momentum()          trend 기울기 (last-first)
Entity.sentimentScore()    MENTIONS 링크 sentiment 가중 집계
Asset.riskScore()          f(impacting RiskSignals, sentiment, volatility)
Topic.heat()               mention velocity
Signal.recomputeConfidence() = f(evidenceCount, 소스 다양성)
Subreddit.communitySentiment()
```

Action과 UI가 이 Function을 호출. 엔진/뷰에 흩어진 계산을 여기로 모음.

## 5. Lineage / Backing datasets

모든 인스턴스에 시스템 필드:
```
{ __type, __pk, __backingDataset, __sourceRefs:[postId...], __ingestedAt, __derivedBy? }
```
Lineage 뷰: `Signal → EVIDENCED_BY → RedditPost → AUTHORED_BY/POSTED_IN → Author/Subreddit → ingestion job`.
"이 리스크 시그널이 왜 떴나"를 소스 글까지 클릭으로 내려감.

## 6. Type ↔ Instance 분리 (코드 구조)

```
src/ontology/
  types/objectTypes.js     ObjectType 레지스트리 (스키마만)
  types/linkTypes.js       LinkType 레지스트리 (카디널리티/endpoint/inverse)
  types/actionTypes.js     ActionType 레지스트리 (params/validate/apply)
  functions/index.js       파생 Function 등록부
  store/ontologyStore.js   인스턴스 스토어 + 타입 검증 + action dispatch(reducer)
  ingest/mockDataset.js     현재 mockOntologyData → '인스턴스 데이터셋'으로 강등
  ingest/redditIngest.js    (후속) 라이브 인제스트
  rag/graphRagEngine.js    retrieval/answer (LLM 교체 가능)
```
→ 현재 `mockOntologyData.js` = 타입 레지스트리에 *검증되는 인스턴스 데이터셋*이 됨. 스키마는 types/에.

---

## 7. 단계별 로드맵 (네가 고른 4개 통합)

- **Phase 1 — 온톨로지 정식화 (팔란티어급 강화).** Type/Instance 분리 + ObjectType/LinkType 레지스트리 + **Action 레이어** + Functions + Lineage. *API 키 불필요.*
- **Phase 2 — 앱 내장 Ontology Manager 뷰.** 타입/링크/액션/라인리지를 앱 탭으로. 방금 만든 군집 다이어그램 = 라이브 탭. *(너의 "온톨로지 뷰 내장")*
- **Phase 3 — 진짜 GraphRAG 엔진.** 임베딩 retrieval + Claude 합성(스왑 가능). *Claude API 키 필요.*
- **Phase 4 — 멀티 에이전트 추출 파이프라인.** 라이브/대량 텍스트 → 병렬 엔티티·관계 추출 → 검증 → 인스턴스 스토어 적재. *Workflow, 토큰 큼.*

권장 순서: **1 → 2 → 3 → 4** (기반 먼저, 그다음 시각화로 검증, 그다음 지능, 마지막 라이브).

---

## 8. 같이 정할 것 (열린 결정)

- **D1. Claude API 키** 사용 가능? (Phase 3/4 실 LLM 필요) → 가능 / 나중 / 결정론 유지
- **D2. Action(write-back) 레이어**를 Phase 1에 넣을까? (팔란티어 핵심) → 포함 / 읽기전용 먼저
- **D3. 데이터 영속성** — 새로고침해도 유지(localStorage) vs 세션 메모리만
- ✅ **D5. 시장 포커스** — **미국 확정** (DART는 한국 확장 시 후속)
- ⏳ **D1. Claude API 키** — Phase 3에서 결정 (Phase 1/2는 불필요)
- ✅ **D2. Action 레이어** — **Phase 1 포함** (5개: acknowledgeSignal·escalateRisk·addToWatchlist·createWatchlist·annotateEvidence)
- ✅ **D3. 영속성** — **localStorage 저장 + Reset 버튼** + append-only 이력 로그
- ✅ **D4. 첫 스프린트 범위** — §12 Phase 1 수용기준 전체
- ✅ **D5. §1 프로퍼티 스키마** — 11개 타입 전부 확정 (위 §1)

---

## 9. External Data Connectors (DART · 금융 API) — Phase 3.5/4

데이터 소스는 새 기능이 아니라 **온톨로지의 ingestion 커넥터**다. 각 소스를 객체/링크로 매핑:

| 소스 (🇺🇸) | → Object Type | → Link / 용도 | 비고 |
|---|---|---|---|
| **SEC EDGAR** 공시 (8-K/10-Q/10-K) | `Event`(공시), `Organization`(filer), 재무 properties | `RELATED_TO_EVENT`, Org 재무 Function | 무료, CIK/ticker 매핑, JSON(`data.sec.gov`) |
| **시세 API** (Finnhub·AlphaVantage·Polygon) | `AssetOrTicker` 가격/변동성 properties | 가격 급변 → `RiskSignal`/`SentimentSignal` 자동 생성 | 무료티어 키, 지연 시세 |
| **뉴스/RSS** (Finnhub news·RSS) | `Event`, `Topic` | `MENTIONS`, `RELATED_TO_EVENT` | 감성 추출 결합 |
| **Reddit API** | `RedditPost`, `Author`, `Subreddit` | 전체 그래프의 원천 | Phase 4 핵심 |
| ~~DART 전자공시~~ | (한국 확장 시) `Event`/`Organization` | 동일 패턴 | **후속** — 한국 시장 추가할 때 |

**커넥터 인터페이스:** `connector.fetch() → rawRecords[] → mapToInstances(typeRegistry) → store.upsert()`.
모든 인스턴스에 `__backingDataset = 'dart' | 'kis' | 'reddit'` 스탬프 → lineage에 출처 표시.

**⚠️ 아키텍처 제약 (순수 프론트엔드):** 브라우저 직접 호출은 **CORS + API 키 노출** 문제. 3가지 선택:
- (a) **빌드타임 스냅샷 JSON** — 데모/발표용 추천. 키 안전, 오프라인 동작.
- (b) **경량 서버리스 프록시**(Vercel/Cloudflare Functions) — 준실시간.
- (c) 로컬 dev 프록시 — 개발 중만.

→ 결론: 온톨로지는 커넥터를 *받을 구멍*으로 설계해두고, SEC/시세는 **스냅샷(a)**으로 먼저 붙이는 게 안전. 실시간은 프록시(b)로 승급.

---

## 10. 레지스트리 실제 형태 (코딩 시 모호함 0) — 확정 대상

타입/링크/액션을 "정의 객체"로 등록한다. 아래가 그 정확한 형태다.

```js
// types/objectTypes.js — ObjectType 정의
export const Organization = {
  apiName: "Organization",
  pk: "id",
  titleProp: "label",
  baseType: "Entity",                 // Entity 계열 상속 (공통 프로퍼티)
  properties: {
    id:        { type: "string", required: true },
    label:     { type: "string", required: true },
    ticker:    { type: "string" },
    domain:    { type: "string" },
    frequency: { type: "int",    default: 0 },
    sentiment: { type: "double", range: [-1, 1] },
    confidence:{ type: "double", range: [0, 1] },
  },
};

// types/linkTypes.js — LinkType 정의 (카디널리티 + endpoint + inverse + 링크 프로퍼티)
export const MENTIONS = {
  apiName: "MENTIONS",
  from: "RedditPost", to: ["Organization","Product","Person","AssetOrTicker","Topic"],
  cardinality: "many-to-many",
  inverse: "MENTIONED_IN",
  linkProps: { weight: { type: "double" }, sentiment: { type: "double", range: [-1,1] } },
};

// types/actionTypes.js — ActionType 정의 (kinetic write-back)
export const acknowledgeSignal = {
  apiName: "acknowledgeSignal",
  label: "Acknowledge signal",
  params: { signalId: { type: "ref", to: "Signal", required: true } },
  validate: (store, p) => store.get(p.signalId)?.status === "open" || "이미 처리된 시그널",
  apply: (store, p) => store.patch(p.signalId, { status: "ack", ackAt: store.now() }),
};
```

→ **확정할 것:** 프로퍼티 목록/타입/제약을 ObjectType별로 못 박기 (§1 보강). 링크 프로퍼티 어디까지. Action 검증 규칙.

## 11. Action 레이어 & 스토어 (D2/D3 확정)

```js
// store/ontologyStore.js — 인스턴스 스토어 + 타입 검증 + action dispatch
createStore(dataset, { objectTypes, linkTypes, actionTypes })
  .validate()                 // 인스턴스를 ObjectType 스키마에 대해 검증
  .dispatch("acknowledgeSignal", { signalId })   // validate→apply→새 상태, 이력 로그
  .subscribe(fn)              // React가 구독 → UI 자동 갱신
```

- **D2 (Action 범위):** Phase 1 최소 = `acknowledgeSignal`, `escalateRisk`, `addToWatchlist`, `createWatchlist`, `annotateEvidence`. (mergeEntities/linkPostToEntity는 Phase 2.)
- **D3 (영속성):** 액션 결과를 `localStorage`에 저장 → 새로고침해도 유지. "Reset ontology" 버튼으로 초기화.
- 모든 dispatch는 **append-only 이력 로그**(actor/action/params/시각) → 감사(audit) + lineage.

## 12. Phase 1 수용 기준 (Definition of Done) — ✅ 완료

- [x] `types/`에 ObjectType·LinkType·ActionType 레지스트리 존재, 모든 타입 정의됨
- [x] 현 `mockOntologyData` → `ingest/usFinanceDataset.js` 인스턴스로 이전, **스키마 검증 통과** (44 objects, 150 links)
- [x] `ontologyStore` 가 인스턴스 보유 + 타입 검증 + 5개 Action dispatch 동작
- [x] Functions(`momentum`, `sentimentScore`, `riskScore`, `heat`, `recomputeConfidence`, `communitySentiment`) 등록 + 테스트
- [x] Lineage: 시그널 → EVIDENCED_BY → Post → Author/Subreddit 추적 (`lineage.js`)
- [x] 액션 결과 localStorage 영속 + append-only 이력 로그 (`ontologyStore`)
- [x] **기존 앱 그대로 동작** (`npm run build` 604 모듈 무회귀)
- [x] Node 스모크 테스트 전부 green (`scripts/ontology-smoke.mjs`)

✅ **"팔란티어형(라이트 졸업)" 1단계 완료.** 다음 = Phase 2(앱 내장 Ontology 뷰).

### Phase 1 산출물 (파일)
```text
src/ontology/types/objectTypes.js      11 ObjectType + 프로퍼티 스키마 + Watchlist
src/ontology/types/linkTypes.js        12 LinkType (카디널리티/inverse/링크프로퍼티)
src/ontology/types/actionTypes.js      5 Action (kinetic write-back)
src/ontology/store/ontologyStore.js    인스턴스 + 검증 + dispatch + localStorage + 이력
src/ontology/functions/index.js        파생 Functions 6종 + 레지스트리
src/ontology/ingest/usFinanceDataset.js mock → 타입드 인스턴스 (Post/Author/Subreddit 포함)
src/ontology/lineage.js                EVIDENCED_BY 라인리지 추적
scripts/ontology-smoke.mjs             §12 수용기준 헤드리스 검증
```

## 13. Engine 고도화 — GraphRAG (seocho 참고, 팔란티어 베이스) ✅

seocho 아키텍처에서 **아이디어만** 차용 (Python/Neo4j/Agents 런타임은 미사용). 중심은 팔란티어 온톨로지.

차용한 핵심: seocho GraphRAG handoff의 invariant —
`question intent → required slots → selected subgraph → evidence bundle → grounded answer(+missing)`.
그래프를 *약한 힌트*가 아니라 **답변의 본체(substrate)**로 사용.

파이프라인 (전부 결정론, store-native, LLM/MCP로 동일 contract 교체 가능):
```text
질문 → matchIntent (5 intents) → resolveAnchors (단어경계 매칭, 질문순 정렬, grounded 플래그)
     → fillSlot (선언적 slot 스키마: via/dir/nodeTypes/linkPolarity 순회)
     → [impact_path] BFS 경로탐색
     → buildBundle: evidence(EVIDENCED_BY lineage) + supportStatus + missingSlots 명시
     → answerWithGraphRAG = { summary, supportStatus, confidence, slots, evidence, path, contextHash }
```

정직성 장치 (seocho 원칙):
- **supportStatus** = `supported | partial | unsupported` (필수 slot 충족 + 근거 동반 시에만 supported)
- **앵커 미해소 → 무조건 unsupported** (날조 금지) — "날씨 좋은 이유?" 같은 질문은 아무것도 주장 안 함
- **missingSlots 명시** — 그래프에 없는 부분을 답변이 스스로 밝힘
- **ontologyContext + hash** — 답변이 어떤 contract에 grounding됐는지 동반 (전 루프 불변식)

산출물:
```text
src/ontology/engine/ontologyContext.js  타입/관계/카운트 + 해시 (loop 불변식)
src/ontology/engine/intents.js          5 intent + 선언적 slot 스키마 (intent 추가 = 데이터)
src/ontology/engine/queryPlanner.js     anchor 해소 + slot 충전 + BFS 경로
src/ontology/engine/evidenceBundle.js   evidence + supportStatus + missing + grounded 합성
src/ontology/engine/index.js            answerWithGraphRAG(store, q) facade
scripts/ontology-engine-smoke.mjs       5 intent + 정직성(날조금지) 검증 — ALL GREEN
```

### 그래프 고도화
finance 온톨로지: 21노드 → **47노드 / 75엣지 / 14 근거글** (반도체 공급망·AI capex super-cycle·매크로 rate transmission·크립토 유동성·리스크 에스컬레이션). 링크 프로퍼티 `polarity`/`strength`/`pmi`. 스토어 검증 통과(78 obj / 260 link 포함 소스객체), 앱 렌더 무회귀.
