/**
 * Cohere live demo — real Embed + Rerank against the finance ontology.
 * Skips gracefully when COHERE_API_KEY is unset (never breaks offline CI).
 *   COHERE_API_KEY=…  npm run cohere:live
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { buildVectorIndexAsync, CohereEmbedder } from "../src/ontology/embeddings/index.js";
import { CohereReranker, rerankCandidatesWithCohere } from "../src/ontology/rerank/cohereReranker.js";
import { answerWithGraphRAG } from "../src/ontology/engine/index.js";

const embedder = new CohereEmbedder();
const reranker = new CohereReranker();

if (!embedder.available) {
  console.log("⏭  No COHERE_API_KEY set — skipping Cohere live demo.");
  console.log("   export COHERE_API_KEY=… then: npm run cohere:live");
  process.exit(0);
}

const store = createStore(buildUsFinanceDataset());
const query = "supply-chain chokepoint risk for advanced AI chips";

// 1) Cohere embeddings → semantic search (input_type handled per Cohere best practice)
console.log(`Embed model=${embedder.model} · Rerank model=${reranker.model}\n`);
const index = await buildVectorIndexAsync(store, embedder);           // docs → search_document
const qv = await embedder.embed(query, "search_query");               // query → search_query
console.log(`q="${query}"`);
console.log("  Cohere embed top-5:", index.search(qv, 5).map((h) => `${h.meta.label}(${h.score.toFixed(2)})`).join(", "));

// 2) Cohere Rerank over the GraphRAG-expanded candidates (KG-RAG stage 3 upgrade)
const ans = answerWithGraphRAG(store, "Which companies are connected to AI datacenter discussions?");
const candidates = ans.relatedNodes;
const reordered = await rerankCandidatesWithCohere(reranker, store, "AI datacenter compute supply chain", candidates);
console.log("\n  graph candidates (pre-rerank):", candidates.map((c) => c.label).join(", "));
console.log("  Cohere reranked:              ", reordered.map((c) => `${c.label}(${c.cohereScore})`).join(", "));

console.log("\n✅ Cohere live demo complete — real embeddings + purpose-built reranker on the same retrieval code.");
