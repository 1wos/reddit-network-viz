# Expert Review — bottleneck & quality audit

QA·온톨로지·팔란티어·GraphRAG·RAG 전문가 5인이 *현재 코드*를 꼼꼼히 검토하고 **병목**을 찾는다.
현 규모(78노드/260링크)에선 `answer`가 0.144ms로 빠르다 → 병목은 *지금의 기능*이 아니라 **확장성·품질·운영 깊이**다.

## 패널 진단

### Tae-ho — _QA Lead_
게이트(7종 스모크+eval+lint)는 탄탄하지만 **테스트 폭이 좁다**: 골든셋 19개뿐, property-based/퍼징 없음, **CI 없음**(로컬 수동), UI(앱) 테스트 0, LLM 경로는 키 의존이라 게이트 밖. → 골든셋 50+로 확장 + GitHub Actions CI + UI 스모크(Puppeteer) 1개.

### Hannah — _Ontology Engineer_
lint/CQ는 훌륭(0/0, 10/10). 약점: **inverse 링크 미구체화**(역방향 탐색은 코드로만), **reasoner 없음**(transitive IMPACTS 추론·서브클래스 추론), Watchlist 미사용 타입, **버저닝/마이그레이션 없음**, 단일 도메인. → reasoner(전이추론) 1개 + 도메인 2번째(뉴스/커머스)로 재사용성 증명.

### Daniel — _Palantir Forward-Deployed Engineer_
Action 레이어는 진짜지만 **5개로 얕고**, **권한/감사 actor가 형식적**(누가-언제만, 권한 체크 없음), **Action→Function 캐스케이드 없음**(액션 후 파생값 재계산 안 됨), control-plane 프로파일이 **메모리만**(영속·승급 워크플로 없음). → ack/escalate가 confidence를 재계산하는 캐스케이드 1개 + 프로파일 영속(localStorage/파일).

### Lena — _GraphRAG Researcher_
intent→slot→evidence→grounded 골격은 정석. 병목: **HashingEmbedder 재현율 상한(33~66%)** — 진짜 의미검색 아님, **community/global 요약 없음**(Microsoft GraphRAG의 핵심), 멀티홉이 BFS뿐, **answer-faithfulness를 LLM judge로 검증 안 함**. → 임베딩 API(Mistral/Gemini) 교체로 recall 점프 *측정* + LLM-judge faithfulness.

### Marco — _RAG Systems Engineer_
구조적 확장 병목: `store.getLinks/neighbors`가 호출마다 **전체 링크 선형 스캔**(O(L)), `VectorIndex.search`가 **O(N)** — 78노드선 무시할 수준이나 10k+에서 터짐. **인접 인덱스(adjacency) 없음**, **관측성/트레이싱 0**, ingest 배치/중복제거 없음, LLM 프로바이더 **재시도/레이트리밋 없음**. → 인접 인덱스(O(1) 이웃) + 트레이싱 훅 + ANN/pgvector 스왑 문서화.

## 🔧 병목 우선순위 (영향 × 비용)

| # | 병목 | 영향 | 비용 | 추천 |
|---|---|---|---|---|
| 1 | **임베딩 품질**(Hashing 상한) | retrieval recall 직접 | 낮음(키만) | **즉시** — Mistral/Gemini 임베딩 교체 + recall 재측정 |
| 2 | **CI 부재** | 회귀 못 막음 | 낮음 | **즉시** — GitHub Actions로 test:ontology |
| 3 | **인접 인덱스 부재**(O(L) 스캔) | 확장성 | 중 | store에 adjacency Map → O(1) 이웃 |
| 4 | **Action 캐스케이드/권한** | 팔란티어 깊이 | 중 | ack→confidence 재계산, actor 권한 |
| 5 | **LLM-judge faithfulness** | 평가 신뢰도 | 중(키) | judge로 답변 충실도 채점 |
| 6 | **community 요약 없음** | global 질문 약함 | 높음 | GraphRAG 커뮤니티 요약(후순위) |
| 7 | **단일 도메인** | 재사용성 증명 | 중 | 2번째 도메인(뉴스/커머스) |

## 합의
현 기능은 견고하나, **(1) 임베딩 품질 + (2) CI**가 가장 싸고 효과 큰 즉시 처리감. 그다음 **(3) 인접 인덱스**(확장성)와 **(4) Action 캐스케이드**(팔란티어 깊이). community 요약·2번째 도메인은 임팩트 크지만 비용도 커서 후순위.
