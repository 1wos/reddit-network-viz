/**
 * Multi-provider benchmark — empirical comparison across embedding + rerank APIs.
 *
 *   node scripts/bench-providers.mjs            (or: npm run bench:providers)
 *   OPENAI_API_KEY=… COHERE_API_KEY=… UPSTAGE_API_KEY=… npm run bench:providers
 *
 * Runs whatever providers have keys (the deps-free HashingEmbedder always runs as
 * the baseline); the rest are skipped with a note. This is the "I didn't just wire
 * the APIs, I measured them" evidence — the answer to "why this model?".
 *
 *  A) Embeddings — paraphrase retrieval recall@3 + mean query-embed latency.
 *  B) Rerank     — MRR of the gold anchor over a fixed candidate pool
 *                  (none → heuristic blend → Cohere cross-encoder).
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import {
  buildVectorIndex, buildVectorIndexAsync, semanticSearch, rerankByVector,
  resolveEmbedder, defaultEmbedder,
} from "../src/ontology/embeddings/index.js";
import { CohereReranker, rerankCandidatesWithCohere } from "../src/ontology/rerank/cohereReranker.js";
import { PARAPHRASE_SET } from "../eval/paraphraseSet.js";

const store = createStore(buildUsFinanceDataset());
const N = PARAPHRASE_SET.length;
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const now = () => Number(process.hrtime.bigint()) / 1e6;
async function timed(fn) { const t = now(); const r = await fn(); return { r, ms: now() - t }; }
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

// ── A) Embedding providers: recall@3 + latency ────────────────────────────────
console.log("\n=== A) Embedding providers — paraphrase recall@3 + latency ===");
console.log(`${pad("provider", 12)} ${padL("recall@3", 9)} ${padL("buildMs", 9)} ${padL("q-embed ms", 11)}  note`);

const EMBED_PROVIDERS = ["hashing", "openai", "cohere", "upstage", "gemini", "mistral"];
for (const name of EMBED_PROVIDERS) {
  let embedder, real, note = "";
  if (name === "hashing") { embedder = defaultEmbedder; real = true; note = "deps-free baseline"; }
  else {
    ({ embedder, real } = resolveEmbedder({ provider: name }));
    if (!real) { console.log(`${pad(name, 12)} ${padL("—", 9)} ${padL("—", 9)} ${padL("—", 11)}  ⏭ no key`); continue; }
  }
  try {
    const { r: index, ms: buildMs } = await timed(() => buildVectorIndexAsync(store, embedder));
    let hit = 0, qms = 0;
    for (const c of PARAPHRASE_SET) {
      const { r: qv, ms } = await timed(() => embedder.embed(c.q, "search_query"));
      qms += ms;
      const top = index.search(qv, 3).map((h) => h.id);
      if (c.anchorsAny.some((a) => top.includes(a))) hit++;
    }
    console.log(`${pad(name, 12)} ${padL(pct(hit, N) + "%", 9)} ${padL(buildMs.toFixed(0), 9)} ${padL((qms / N).toFixed(1), 11)}  ${note}`);
  } catch (e) {
    console.log(`${pad(name, 12)} ${padL("ERR", 9)} ${padL("—", 9)} ${padL("—", 11)}  ${String(e.message).slice(0, 50)}`);
  }
}
console.log("  → recall@3 = paraphrase queries whose gold anchor lands in the top-3 (real embeddings should beat hashing).");

// ── B) Rerankers: MRR of the gold anchor over a fixed candidate pool ───────────
console.log("\n=== B) Rerank — MRR of gold anchor over a top-10 candidate pool ===");
const hidx = buildVectorIndex(store);                       // one retriever feeds all rerankers (isolates rerank effect)
const poolFor = (q) => semanticSearch(hidx, q, 10, defaultEmbedder).map((h) => h.id);
const rankOfGold = (ordered, anchorsAny) => {
  const i = ordered.findIndex((id) => anchorsAny.includes(id));
  return i < 0 ? 0 : 1 / (i + 1);
};
async function mrr(orderFn) {
  let s = 0;
  for (const c of PARAPHRASE_SET) s += rankOfGold(await orderFn(c.q, poolFor(c.q)), c.anchorsAny);
  return (s / N).toFixed(3);
}

const reranker = new CohereReranker();
const rows = [
  ["none (retriever order)", async (q, ids) => ids],
  ["heuristic (vector blend)", async (q, ids) => rerankByVector(hidx, q, ids.map((id) => ({ id })), { embedder: defaultEmbedder }).map((c) => c.id)],
];
if (reranker.available) {
  rows.push(["cohere rerank-v3.5", async (q, ids) => (await rerankCandidatesWithCohere(reranker, store, q, ids.map((id) => ({ id })))).map((c) => c.id)]);
} else {
  console.log("  (cohere rerank skipped — set COHERE_API_KEY to include it)");
}
console.log(`${pad("reranker", 26)} ${padL("MRR", 7)}`);
for (const [label, fn] of rows) console.log(`${pad(label, 26)} ${padL(await mrr(fn), 7)}`);
console.log("  → MRR↑ = gold anchor ranked higher after reranking (1.0 = always rank 1).");
