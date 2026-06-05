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
ok(det.synthesizedBy === "deterministic", "no LLM → deterministic synthesis");

// 2) NullLLM (available=false) → deterministic
const nl = await answerWithGraphRAGLLM(store, Q, { llm: new NullLLM() });
ok(nl.synthesizedBy === "deterministic", "NullLLM → deterministic fallback");

// 3) FakeLLM → LLM synthesizes, summary replaced
const llm = await answerWithGraphRAGLLM(store, Q, { llm: fakeLLM });
ok(llm.synthesizedBy === "llm" && llm.summary === "FAKE-LLM grounded answer.", "LLM available → synthesized by LLM");

// 4) Grounded prompt carries the anti-fabrication rules + evidence + supportStatus
ok(/ONLY from the ontology evidence/.test(captured.system), "prompt: includes the no-fabrication rule");
ok(/support_status is "supported"/.test(captured.system), "prompt: supportStatus injected");
ok(/<grounded_context>/.test(captured.user) && captured.user.includes('"supportStatus"'), "prompt (user): XML grounded_context + JSON");
// Gemini practice: most-critical constraint placed LAST (<critical> near the end)
ok(captured.system.lastIndexOf("<critical>") > captured.system.length * 0.5, "prompt: critical constraint (<critical>) placed last");

// 5) Extraction prompt: XML structure + ontology-constrained + few-shot example
const ext = entityExtractionPrompt("NVIDIA relies on TSMC for advanced chips.");
ok(/<object_types>.*Organization/.test(ext.system) && /<relationship_types>.*IMPACTS/.test(ext.system), "extraction prompt: constrained to ontology types/relations");
ok(/<example>/.test(ext.system), "extraction prompt: includes a few-shot example");

// 5b) Metaprompt (Anthropic) generates a task prompt; technique provenance recorded
const mp = metaPrompt("classify a Reddit post's market sentiment", ["post"]);
ok(/prompt engineer/i.test(mp.system) && /\{\{POST\}\}/.test(mp.user), "metaprompt: generates a prompt with variables");
ok(PROMPT_TECHNIQUES.length >= 5 && PROMPT_TECHNIQUES.every((t) => t.source), "prompt techniques record their provider source");

// 6) Unsupported question → prompt tells the LLM to refuse
const weather = answerWithGraphRAG(store, "Why is the weather nice today?");
ok(weather.supportStatus === "unsupported", "no-evidence question → unsupported (LLM told to refuse)");

console.log(failed ? `\n❌ ${failed} failed` : "\n✅ ALL GREEN — LLM path (grounded prompt + deterministic↔LLM toggle)");
process.exit(failed ? 1 : 0);
