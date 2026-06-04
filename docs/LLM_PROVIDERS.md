# LLM Providers — provider-agnostic layer + free options

이 프로젝트의 LLM 레이어는 **provider-agnostic**다. `OpenAICompatibleLLM` 한 어댑터가
OpenAI 호환 백엔드 전부를 지원하고, 호환되지 않는 Claude는 별도 어댑터로 둔다.
바꾸려면 환경변수 하나(`LLM_PROVIDER`)만 바꾸면 된다.

```bash
LLM_PROVIDER=kimi   node scripts/llm-live.mjs "질문"     # 또는 claudecode / groq / gemini ...
```

## 지원 프로바이더 (env `LLM_PROVIDER` 값)

| provider | 무료? | 키 env | 가입 | 기본 모델 | 상태(우리 테스트) |
|---|---|---|---|---|---|
| **claudecode** | ✅ **키 불필요** | — (로컬 `claude` CLI) | 이미 설치됨 | claude-code-cli | ✅ **검증됨(라이브)** |
| **kimi** (moonshot) | 유료(저렴) | `MOONSHOT_API_KEY` | platform.moonshot.ai | kimi-k2.5 | ✅ **검증됨(라이브)** |
| **mistral** | ✅ **월 ~10억 토큰 무료** | `MISTRAL_API_KEY` | console.mistral.ai | mistral-large-latest | ⬜ (free 매우 후함, 2 RPM) |
| **gemini** (google) | ✅ **1,500 req/day** | `GEMINI_API_KEY` | aistudio.google.com | gemini-2.0-flash | ⬜ 1M 컨텍스트·멀티모달·카드불필요 |
| **groq** | ✅ free (최고 속도) | `GROQ_API_KEY` | console.groq.com | llama-3.3-70b-versatile | ⬜ ~300 토큰/초 |
| **cerebras** | ✅ free (최대 처리량) | `CEREBRAS_API_KEY` | cloud.cerebras.ai | llama-3.3-70b | ⬜ 60K TPM·~1M 토큰/day |
| **sambanova** | ✅ free (프로덕션급) | `SAMBANOVA_API_KEY` | cloud.sambanova.ai | Meta-Llama-3.3-70B | ⬜ |
| **openrouter** | ✅ `:free` 30+ 모델 | `OPENROUTER_API_KEY` | openrouter.ai | llama-3.3-70b-instruct:free | ⬜ 한 키로 여러 모델 |
| **github** (Models) | ✅ 개발자 무료 | `GITHUB_TOKEN` | github.com/marketplace/models | gpt-4o-mini | ⬜ |
| **ollama** | ✅ **로컬·키 불필요** | — | ollama.com (설치) | llama3.2 | ⬜ (오프라인 가능) |
| **openai** | 유료 | `OPENAI_API_KEY` | platform.openai.com | gpt-4o-mini | ❌ 보유 키 만료 |
| **deepseek** | 유료(저렴) | `DEEPSEEK_API_KEY` | platform.deepseek.com | deepseek-chat | ❌ 보유 키 만료 |
| **grok** (xai) | 유료 | `XAI_API_KEY` | console.x.ai | grok-3 | 🔑 키 유효·모델명 지정 필요 |
| **qwen** | free 체험 | `DASHSCOPE_API_KEY` | dashscope (Alibaba) | qwen-plus | ⬜ |
| **doubao** (bytedance) | free 체험 | `ARK_API_KEY` | volcengine Ark | doubao-pro-32k | ⬜ (중국 리전) |
| **claude** (anthropic) | 유료 | `ANTHROPIC_API_KEY` | console.anthropic.com | claude-sonnet-4-6 | ⬜ (SDK 필요) |

각 프로바이더는 `<NAME>_BASE_URL` / `<NAME>_MODEL` 로 오버라이드 가능. (`src/ontology/llm/provider.js`의 `PROVIDERS` 맵)

## 추천 — "무료로 지금 당장"

1. **claudecode** — 네가 이미 쓰는 Claude Code 구독으로 무료. 키 0개. `LLM_PROVIDER=claudecode npm run llm:live`.
2. **Groq** — 무료 + 압도적으로 빠름. 키 1분 발급. 데모용 최고.
3. **Gemini (AI Studio)** — 무료 할당 넉넉. `gemini-2.0-flash` 빠르고 좋음.
4. **Ollama** — 인터넷/키 없이 로컬. 오프라인 데모·CI에 안전.

> Claude를 "API"로 쓰고 싶은데 키 없을 때: **claudecode** provider가 사실상 그 역할(네 CC 구독 활용). 단 이건 *개발/데모용*이고, 프로덕션은 Anthropic API(`claude`)나 AWS Bedrock 권장.

## 코드에서 (provider-agnostic)

```js
import { makeLLM } from "./src/ontology/llm/provider.js";
import { answerWithGraphRAGLLM } from "./src/ontology/engine/index.js";

const llm = makeLLM(process.env.LLM_PROVIDER || "kimi"); // 키 없으면 NullLLM → deterministic 폴백
const answer = await answerWithGraphRAGLLM(store, question, { index, llm });
// answer.synthesizedBy === "llm" | "deterministic"
```

핵심: **무엇을 쓰든 grounding 규칙(supportStatus·근거외 금지·missing 명시)은 동일**하게 프롬프트에 주입된다. 프로바이더는 갈아끼우는 부품일 뿐.

## 더 찾기 (무료 API 큐레이션 — 매주 갱신됨)

- awesome-free-llm-apis: <https://github.com/amardeeplakshkar/awesome-free-llm-apis> (영구 무료, OpenAI SDK 호환 여부·rate limit 표기)
- Free-LLM (45+ providers): <https://github.com/nejib1/Free-LLM>
- mnfst/awesome-free-llm-apis: <https://github.com/mnfst/awesome-free-llm-apis>

요약(2026년 기준): **Gemini**(1,500 req/day) · **Mistral**(월 ~1B 토큰) · **Cerebras**(60K TPM) · **Groq**(최고 속도) · **SambaNova**(프로덕션급) · **OpenRouter**(`:free` 30+ 모델)가 카드 없이 쓸 만한 Tier 1. 대부분 OpenAI 호환이라 우리 `PROVIDERS` 맵에 base URL+모델만 추가하면 끝.

