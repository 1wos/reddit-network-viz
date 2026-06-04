/**
 * LLM live demo — runs one question through the engine twice:
 *   (1) deterministic synthesis   (2) Kimi/Moonshot LLM synthesis
 * over the SAME grounded evidence bundle, so you can compare.
 *
 *   MOONSHOT_API_KEY=... node scripts/llm-live.mjs ["your question"]
 *
 * Never prints the API key. Falls back across model ids if one 404s.
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { buildVectorIndex } from "../src/ontology/embeddings/index.js";
import { answerWithGraphRAG, answerWithGraphRAGLLM } from "../src/ontology/engine/index.js";
import { makeLLM } from "../src/ontology/llm/provider.js";

const store = createStore(buildUsFinanceDataset());
const index = buildVectorIndex(store);
const Q = process.argv.slice(2).join(" ") || "Why is NVIDIA trending across finance and technology communities?";

console.log(`\nQ: ${Q}\n${"=".repeat(70)}`);

// (1) deterministic
const det = answerWithGraphRAG(store, Q, { index });
console.log(`\n[DETERMINISTIC]  support=${det.supportStatus}  retrieval=${det.retrieval}  conf=${det.confidence}`);
console.log(det.summary);
console.log(`evidence: ${det.evidence.map((e) => e.title).join(" | ")}`);

// (2) LLM synthesis over the SAME bundle — provider chosen by LLM_PROVIDER.
const provider = (process.env.LLM_PROVIDER || "kimi").toLowerCase();
let llm;
if (provider === "claudecode" || provider === "claude-code") {
  const { ClaudeCodeLLM } = await import("../src/ontology/llm/claudeCode.js"); // node-only, no key
  llm = new ClaudeCodeLLM();
  llm.model = "claude-code-cli";
} else {
  llm = makeLLM(provider);
}
if (!llm.available) {
  console.log(`\n[LLM:${provider}] 키 미설정 — deterministic만 실행됨.`);
  process.exit(0);
}
const a = await answerWithGraphRAGLLM(store, Q, { index, llm });
if (a.synthesizedBy === "llm") {
  console.log(`\n[${provider.toUpperCase()} · ${llm.model}]  (synthesized from the grounded bundle)`);
  console.log(a.summary);
} else {
  console.log(`\n[${provider}] 실패: ${a.llmError?.slice(0, 200)}`);
}
