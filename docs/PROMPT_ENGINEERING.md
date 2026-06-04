# Prompt Engineering — applied techniques + cookbook index

우리 프롬프트 레이어([`src/ontology/llm/prompts.js`](../src/ontology/llm/prompts.js))는 각 제공사의
**공식 프롬프트 가이드/쿡북**의 베스트 프랙티스를 의도적으로 적용했다. 무엇을, 어디서,
어떻게 적용했는지 추적 가능하게 정리한다(`PROMPT_TECHNIQUES`로 코드에도 기록).

## 적용한 기법 → 출처 → 적용 위치

| 기법 | 출처(공식 가이드) | 우리 적용 |
|---|---|---|
| **XML 태그 구조화** (`<role>`,`<rules>`,`<grounded_context>`) | Anthropic (Claude는 XML로 학습됨, 일관성↑) | `answerSynthesisPrompt`, `entityExtractionPrompt` |
| **reference text로 엄격 grounding** (제공 컨텍스트 밖 사용 금지) | OpenAI 6원칙 #5 | `<grounded_context>` + 환각 금지 규칙 |
| **few-shot 예시** | OpenAI / Anthropic | 추출 프롬프트의 `<example>` |
| **JSON-schema structured output** | Google Gemini / OpenAI | `EXTRACTION_SCHEMA`, 추출 출력 계약 |
| **가장 중요한 제약을 맨 끝에** | Google Gemini | `<critical>` 블록(support_status·환각금지)을 system 끝에 |
| **작업 분할 / 생각할 시간** | OpenAI | intent→slot→subgraph→answer 단계 분리(엔진) |
| **metaprompt (작업→프롬프트 생성)** | Anthropic cookbook | `metaPrompt()` |

## 환각 방지 설계 (핵심)

답변 프롬프트는 grounding을 *구조적으로* 강제한다:
- `<grounded_context>`에 있는 엔티티/근거만 사용 (밖의 지식 금지)
- `support_status`가 `unsupported`면 답하지 말고 멈추라고 **맨 끝 `<critical>`**에 명시
- 누락된 slot은 "그래프에 없음"으로 *명시*하게 지시

→ 실측: Kimi K2.5(reasoning)는 사고과정에서 *근거 없는 엔티티를 스스로 제외*했고, `npm run eval`의
citation-faithfulness 98.5% / no-fabrication 100%로 측정된다.

## 프로바이더별 실전 팁 (우리가 부딪힌 것)

- **Kimi K2.5**: `temperature=1` 강제 + reasoning 모델이라 `max_tokens` 넉넉히(≥4096). 출력이 `reasoning_content`로 올 수 있어 폴백 처리.
- **OpenAI/Gemini/Groq/Mistral**: 표준 OpenAI 호환, `temperature` 자유. JSON 강제는 structured output 사용 권장.
- **ClaudeCode(CLI)**: 키 없이 무료. XML 프롬프트와 궁합 좋음(라이브 검증).

## 공식 쿡북 인덱스 (더 깊이 파고들 레퍼런스)

- OpenAI Cookbook — <https://developers.openai.com/cookbook>
- Gemini Cookbook — <https://ai.google.dev/gemini-api/cookbook>
- Claude Cookbook — <https://platform.claude.com/cookbook/> · GitHub <https://github.com/anthropics/claude-cookbooks>
- xAI Grok Cookbook — <https://github.com/xai-org/xai-cookbook>
- Meta Llama Cookbook — <https://github.com/meta-llama/llama-cookbook>
- Mistral Cookbook — <https://github.com/mistralai/cookbook>
- Cohere Cookbooks — <https://docs.cohere.com/docs/cookbooks>
- NVIDIA Nemotron Cookbook — <https://github.com/NVIDIA-NeMo/Nemotron/tree/main/usage-cookbook>
- Qwen3 Cookbooks — <https://github.com/QwenLM/Qwen3-VL/tree/main/cookbooks>
- Moonshot/Kimi Cookbook — <https://github.com/MoonshotAI/MoonshotAI-Cookbook>
- Perplexity API Cookbook — <https://github.com/perplexityai/api-cookbook>

### 가이드(설계 근거)
- Anthropic prompt engineering — <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering>
- OpenAI prompt engineering — <https://developers.openai.com/api/docs/guides/prompt-engineering>
- Google Gemini prompting — <https://ai.google.dev/gemini-api/docs/prompting-strategies>

> 다음 단계(선택): 위 쿡북에서 provider별 *구조화 출력/tool-use/평가* 노트를 더 흡수해, 추출 프롬프트를 tool-use 강제 출력으로 승격하고 프롬프트 A/B를 eval에 추가.
