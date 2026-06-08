/**
 * Real-embedding live demo (③) — builds the vector index with a REAL semantic
 * embedder (any OpenAI-compatible /embeddings endpoint) when a key is configured,
 * and compares its retrieval head-to-head against the deps-free HashingEmbedder.
 * Skips gracefully when no key is set (so it never breaks offline CI).
 *
 *   OPENAI_API_KEY=…  npm run embed:live
 *   EMBED_PROVIDER=mistral MISTRAL_API_KEY=…  npm run embed:live
 *   EMBED_BASE_URL=…  EMBED_API_KEY=…  EMBED_MODEL=…  npm run embed:live
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { buildVectorIndex, buildVectorIndexAsync, resolveEmbedder, defaultEmbedder } from "../src/ontology/embeddings/index.js";

const { embedder, real } = resolveEmbedder({ provider: process.env.EMBED_PROVIDER });

if (!real) {
  console.log("⏭  No embedding API key set — skipping real-embedding demo.");
  console.log("   Set OPENAI_API_KEY (or EMBED_API_KEY / MISTRAL_API_KEY / GEMINI_API_KEY) to run it.");
  process.exit(0);
}

const store = createStore(buildUsFinanceDataset());

// Paraphrase queries with NO exact entity label — the case where real semantic
// embeddings should clearly out-retrieve lexical/hashing vectors.
const QUERIES = [
  "central bank monetary policy and the rate path",
  "GPU chips for training large AI models",
  "supply-chain chokepoint risk for advanced semiconductors",
];

console.log(`Using REAL embeddings: model=${embedder.model}`);
const realIndex = await buildVectorIndexAsync(store, embedder);
const hashIndex = buildVectorIndex(store, defaultEmbedder);
console.log(`indexed ${realIndex.size} nodes (real) / ${hashIndex.size} (hashing)\n`);

const fmt = (hits) => hits.map((h) => `${h.meta.label} (${h.score.toFixed(2)})`).join(", ");

for (const q of QUERIES) {
  const realTop = realIndex.search(await embedder.embed(q), 3);
  const hashTop = hashIndex.search(defaultEmbedder.embed(q), 3);
  console.log(`q="${q}"`);
  console.log(`  real:    ${fmt(realTop)}`);
  console.log(`  hashing: ${fmt(hashTop)}\n`);
}

console.log("✅ Real-embedding retrieval demo complete (same VectorIndex/retrieval code, swapped provider).");
