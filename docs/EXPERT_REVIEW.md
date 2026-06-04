# Expert Panel Review — RedditPulse Ontology GraphRAG

6명의 분야 전문가 페르소나가 이 프로젝트를 *비판적으로* 분석한다. 칭찬이 아니라
"채용 관점에서 진짜 통할까 / 어디가 약한가 / 뭘 고치면 격이 오르나"를 본다.

---

## 한지우 — _Knowledge Graph / Ontology Architect (ex-Palantir FDE)_

진짜 **Action 레이어(write-back)** 와 **type↔instance 분리**, 그리고 `EVIDENCED_BY` lineage까지 있어서 "팔란티어형"이라 부를 자격이 있다 — 대부분의 "온톨로지" 데모는 타입 라벨만 붙이고 끝나는데 이건 운영 레이어가 실재한다. 약점은 Action이 5개로 얕고, Foundry의 진짜 깊이인 **Action→Function 연쇄**나 **권한/감사(authorization) 모델**, **온톨로지 버저닝/마이그레이션**이 없다는 것. 고치는 법은 단순하다: Action 하나에 "누가 실행했나 + 다운스트림 Function 재계산 트리거"만 붙여도 깊이가 확 산다. 면접에선 "Foundry의 Action/Function/Lineage vs 내 구현"을 *정확히* 비교 설명할 수 있으면 이긴다.

## Maya Chen — _Staff RAG / Retrieval Engineer_

`intent → slot → subgraph → evidence → grounded(+supportStatus)` 는 RAG의 핵심 난제(환각/grounding)를 정확히 겨냥했고, **앵커 미해소 시 unsupported**로 날조를 막는 설계는 시니어 시그널이다. 하이브리드(어휘+벡터) 폴백도 옳다. 치명적 공백은 **평가(eval)가 없다**는 것 — retrieval recall이나 answer faithfulness를 *측정*하지 않으면 "좋다"를 증명할 수 없다. 그리고 HashingEmbedder는 어휘 기반이라 진짜 의미검색이 아니다(정직하게 표기는 됨). 골든셋(질문 20개 + 기대 노드/근거)을 만들어 `retrieval@k`·faithfulness를 재는 스크립트 하나가 "데모"와 "엔지니어"를 가른다.

## Diego Park — _Principal MLOps / AWS Solutions Architect_

어댑터 패턴으로 PoC↔프로덕션 경계를 깔끔히 그었고, IaC를 **CDK와 Terraform 양쪽**으로 낸 건 배포 사고가 있다는 증거다 — 학부 포폴에서 보기 드물다. 다만 **관측성(구조적 로깅/트레이싱)·CI·실제 배포 검증**이 없다. langgraph를 얹은 Lambda는 패키지 크기/콜드스타트 이슈가 있으니 container 선택은 옳았다. GitHub Actions로 `npm run test:ontology` + `cdk synth`를 CI에서 돌리고, **단 한 번이라도 실제 `cdk deploy` 해서 "돌아갔다"는 증거(스크린샷/로그)**를 남기면 신뢰도가 다른 차원이 된다. 면접에선 "어떻게 운영·모니터링하냐"에 답을 준비해라.

## 김수진 — _Quant Researcher / Market Intelligence (buy-side)_

반도체 공급망·매크로 rate transmission·리스크 에스컬레이션을 *관계로* 모델링한 건 도메인 이해를 보여주고, `polarity/strength` 링크 프로퍼티는 영리하다. 그러나 신호가 **Reddit 감성(정성)뿐**이고 실제 가격/거래량/펀더멘털과 연결되지 않아 "그래서 트레이드 의사결정에 어떻게 쓰나"가 약하다 — 백테스트도 없다. `AssetOrTicker`에 실제 가격 한 개라도 붙이고 "sentiment vs forward return" 단순 상관 하나만 보여도 설득력이 다르다. 정직한 포지셔닝이 중요하다: 이건 **알파(시그널)가 아니라 마켓 인텔리전스(아이디어 생성/리스크 모니터링)** 다 — 그렇게 말하면 오히려 신뢰가 간다.

## Alex Rivera — _Applied AI / Prompt Engineering Lead_

답변 프롬프트에 `supportStatus`·missing·"근거 외 사용 금지"를 *구조적으로* 주입하고, 추출 프롬프트를 온톨로지 타입으로 제약 + JSON 스키마까지 둔 건 structured-output을 제대로 이해한 것이다. 약점은 **few-shot 예시가 없고(zero-shot)**, 프롬프트 버저닝/평가 흔적이 없다는 것 — "prompt tuning 경험"을 말하려면 before/after 케이스가 하나는 있어야 한다. 추출 프롬프트에 good/bad 예시 2개 + tool-use 강제 출력으로 신뢰도를 올리고, 프롬프트 A/B 한 번만 비교해 두면 "엔지니어링했다"가 증명된다.

## Priya Nair — _Hiring Manager · AI Platform (이 JD의 주인)_

스크리닝 통과는 확실하다. 지원자 대부분은 "RAG 튜토리얼 따라함" 수준인데 이건 *아키텍처를 설계*했고 JD 키워드를 **코드로** 매핑했다 — 특히 환각-grounding과 "하나의 contract가 전 루프를 지배"하는 사고가 신선하다. 레드플래그 둘: (1) 전부 목/미배포라 "라이브 데모 보여줘"에서 막히면 감점, (2) 범위가 너무 넓어 *본인이 다 이해했는지* 의심돼 깊이 질문으로 검증할 것이다. 그래서 조언은 명확하다 — **욕심내지 말고 슬라이스 1개를 진짜로(실 LLM + 1배포) + 설계 결정을 *왜* 그렇게 했는지 또렷이**. 면접 전략: README 내러티브를 30초 피치로 외우고, **"정직한 한계"를 먼저 말하라** — 그게 신뢰를 만든다.

---

## 합의 — 다음 3가지 (넓히지 말고 깊게)

1. **평가 골든셋 1개** *(Maya·Diego·Priya 공통)* — 질문 20개 + 기대 노드/근거로 `retrieval@k`·answer faithfulness 측정. "좋다"를 숫자로.
2. **진짜 슬라이스 1개** *(전원 공통)* — `ANTHROPIC_API_KEY`로 LLM 답변합성 **라이브** + 가능하면 실데이터 1건 추출, 데모 GIF. (AWS 없이도 가능)
3. **깊이 > 넓이** *(한지우·Priya)* — 더 만들지 말고, "한 contract가 전 루프 지배 + 환각 grounding"이라는 *한 스토리*를 또렷이. 본인 설명력이 최종 무기.

> 한 줄 총평(Priya): "지금도 상위 10%. 슬라이스 1개를 라이브로 만들고, 한계를 정직하게 말하면 상위 3%."
