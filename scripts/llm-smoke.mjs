/**
 * LLM path smoke test (M4) — verifies grounded prompt assembly + the
 * deterministic↔LLM toggle, WITHOUT any API key (uses a FakeLLM that captures
 * the prompt it receives).
 *   node scripts/llm-smoke.mjs
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { answerWithGraphRAG, answerWithGraphRAGLLM } from "../src/ontology/engine/index.js";
import { entityExtractionPrompt, answerSynthesisPrompt, metaPrompt, PROMPT_TECHNIQUES } from "../src/ontology/llm/prompts.js";
import { NullLLM } from "../src/ontology/llm/provider.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) failed++; };

const store = createStore(buildUsFinanceDataset());
const Q = "Why is NVIDIA trending across finance and technology?";

// FakeLLM captures the grounded prompt and returns a marker answer.
let captured = null;
const fakeLLM = { get available() { return true; }, async generate({ system, user }) { captured = { system, user }; return "FAKE-LLM grounded answer."; } };

// 1) No LLM → deterministic
const det = await answerWithGraphRAGLLM(store, Q, {});
ok(det.synthesizedBy === "deterministic", "LLM 없음 → 결정론 합성");

// 2) NullLLM (available=false) → deterministic
const nl = await answerWithGraphRAGLLM(store, Q, { llm: new NullLLM() });
ok(nl.synthesizedBy === "deterministic", "NullLLM → 결정론 폴백");

// 3) FakeLLM → LLM synthesizes, summary replaced
const llm = await answerWithGraphRAGLLM(store, Q, { llm: fakeLLM });
ok(llm.synthesizedBy === "llm" && llm.summary === "FAKE-LLM grounded answer.", "LLM 가용 → LLM 합성으로 교체");

// 4) Grounded prompt carries the anti-fabrication rules + evidence + supportStatus
ok(/ONLY from the ontology evidence/.test(captured.system), "프롬프트: 근거 외 사용 금지 규칙 포함");
ok(/support_status is "supported"/.test(captured.system), "프롬프트: supportStatus 주입");
ok(/<grounded_context>/.test(captured.user) && captured.user.includes('"supportStatus"'), "프롬프트(user): XML grounded_context + JSON");
// Gemini practice: most-critical constraint placed LAST (<critical> near the end)
ok(captured.system.lastIndexOf("<critical>") > captured.system.length * 0.5, "프롬프트: 핵심 제약(<critical>)을 끝에 배치");

// 5) Extraction prompt: XML structure + ontology-constrained + few-shot example
const ext = entityExtractionPrompt("NVIDIA relies on TSMC for advanced chips.");
ok(/<object_types>.*Organization/.test(ext.system) && /<relationship_types>.*IMPACTS/.test(ext.system), "추출 프롬프트: 온톨로지 타입/관계로 제약");
ok(/<example>/.test(ext.system), "추출 프롬프트: few-shot 예시 포함");

// 5b) Metaprompt (Anthropic) generates a task prompt; technique provenance recorded
const mp = metaPrompt("classify a Reddit post's market sentiment", ["post"]);
ok(/prompt engineer/i.test(mp.system) && /\{\{POST\}\}/.test(mp.user), "메타프롬프트: 변수 포함 프롬프트 생성기");
ok(PROMPT_TECHNIQUES.length >= 5 && PROMPT_TECHNIQUES.every((t) => t.source), "프롬프트 기법 출처(provider) 기록됨");

// 6) Unsupported question → prompt tells the LLM to refuse
const weather = answerWithGraphRAG(store, "Why is the weather nice today?");
ok(weather.supportStatus === "unsupported", "근거 없는 질문 → unsupported (LLM에 거부 지시됨)");

console.log(failed ? `\n❌ ${failed} 실패` : "\n✅ ALL GREEN — LLM 경로 (grounded prompt + 결정론↔LLM 토글) 통과");
process.exit(failed ? 1 : 0);
