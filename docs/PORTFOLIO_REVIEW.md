# Portfolio Review — hiring-lens panel

현재 상태를 채용 관점 5인이 평가한다. 사실: 18 commits · 96 code files · 6 languages
(JS/TS/Python/Go/JSX) · 10 test gates + CI · 9 docs. 핵심 긴장: **엔지니어링 깊이는
상위권인데, 첫인상(메인 README·배포·언어)이 그 깊이를 *안 보여준다*.**

## Rae — _Technical Recruiter (30-second scan)_
GitHub 열면 제일 먼저 보는 게 메인 README인데, 그게 아직 "RedditPulse — keyword
network visualizer"(127줄)야. 온톨로지·MCP·플랫폼·IaC가 *전혀 안 보여서* 평범한 D3
프로젝트로 30초 만에 오판할 위험이 크다. **느낌: "그냥 시각화 토이"** — 깊이를 파보지
않으면 묻힌다. 첫인상에서 가장 큰 손해.

## Priya — _Hiring Manager, AI Platform (this JD's owner)_
`docs/`를 실제로 열어보면 인상이 180도 바뀐다 — grounded GraphRAG, 팔란티어형 온톨로지,
MCP, eval(faithfulness 98.8%), 폴리글랏 플랫폼+OTel까지 JD 항목을 *코드로* 매핑했다.
문제는 "열어볼 이유"를 README가 안 준다는 것. 스크리닝은 통과시키겠지만, **README가
이 깊이를 0.5초에 신호하지 못하면 다른 리뷰어는 놓친다.**

## Marcus — _Staff Engineer (technical interviewer)_
깊이는 명백히 미드~시니어급이다: 온톨로지 control plane, 환각 차단 grounding,
intent→slot→subgraph 리트리벌, 회복탄력 큐(DLQ/idempotency), 분산 트레이싱. 인터뷰에서
파고들 것: "실제로 배포해봤나? Grafana에서 trace 보여줘", "진짜 임베딩이면 recall 얼마?",
"각 설계 결정을 *왜* 그렇게?". **답을 또렷이 하면 강력 통과; 못 하면 '넓지만 얕다'로 본다.**

## Dana — _MLOps / Platform Lead_
큐·retry·DLQ·idempotency·OTel·Helm·ArgoCD·Grafana — 운영 사고가 보인다. 단 **실제로 한
번도 안 돈 게 약점**(코드+config는 완비). `kind`/`minikube`에 `helm install` 한 번 +
Grafana에서 실패 job 추적 스크린샷 하나면 "ship해봤다"가 증명된다. 그 한 장이 큰 차이.

## Sol — _Bar-raiser / Skeptic (harshest take)_
범위가 인상적이지만 두 가지를 의심한다: (1) "이게 깊이냐, AI로 찍어낸 넓이냐" — 후보가
*각 줄을 방어*할 수 있어야 한다. (2) 첫인상이 깊이를 *깎아먹는다* — 메인 README는 옛 제품,
docs는 한국어, 라이브 데모 없음. **재능을 스스로 과소판매 중.** 코드는 상위 5–10%인데
포장이 중위라, 게으른 리뷰어한테는 중위로 읽힌다.

## 합의 — 현재 "느낌"
- **엔지니어링 깊이: 상위 5–10%** (신입 평균 한참 위, 미드급 시스템 설계)
- **현재 프레젠테이션: 중위** (메인 README가 옛 제품, 미배포, 데모 없음)
- **순(net) 인상: 전적으로 "현관문" 수정에 달림.** 깊이는 이미 충분하다 — 안 보일 뿐.

## 다음 3가지 (새로 만들지 말고 *보이게*)
1. **메인 README 프로덕션급 재작성** — 현관문. 아키텍처 다이어그램, 한 줄 피치, 전체
   quickstart(app·mcp·eval·platform), 정량 결과(faithfulness 98.8%·noFab 100%·lint 0/0),
   정직한 한계. *가장 높은 레버리지.*
2. **실제 배포 1개 + 증거** — `helm install`(kind); Grafana trace·라이브
   답변 스크린샷. "deploy at least one" 충족 + 데모 자산.
3. **데모 GIF/영상** — GraphRAG 패널 + 라이브 LLM 답변 + Grafana 실패-추적 한 컷.
   (+무료 임베딩 키로 recall 점프 *수치* 하나 더.)

> Sol 총평: "코드는 면접 30분 떠들 수 있는 수준. 지금 필요한 건 *새 기능이 아니라*,
> 그 깊이를 5초 안에 보이게 만드는 것."
