/**
 * Embeddings — facade: build a contextual vector index over a store and run
 * semantic search. Provider- and index-agnostic (HashingEmbedder + VectorIndex
 * by default; swap for MiniLM/Bedrock + pgvector/OpenSearch via the same calls).
 */

import { HashingEmbedder, defaultEmbedder } from "./provider.js";
import { VectorIndex } from "../vector/vectorIndex.js";
import { contextualText } from "./contextualText.js";

export { HashingEmbedder, defaultEmbedder, contextualText, VectorIndex };

/* Which object types get embedded (entities/topics/signals/events — not posts/subreddits). */
const EMBEDDABLE = new Set(["Organization", "Product", "Person", "AssetOrTicker", "Topic", "Event", "RiskSignal", "SentimentSignal"]);

/** Embed every embeddable node's contextual text into a vector index. */
export function buildVectorIndex(store, embedder = defaultEmbedder) {
  const index = new VectorIndex();
  for (const o of store.all()) {
    if (!EMBEDDABLE.has(o.__type)) continue;
    index.upsert(o.id, embedder.embed(contextualText(store, o)), { label: o.label, type: o.__type });
  }
  return index;
}

/** Semantic search: embed the query and return top-k {id,score,meta}. */
export function semanticSearch(index, query, k = 5, embedder = defaultEmbedder) {
  return index.search(embedder.embed(query), k);
}

/** Async index build for API/remote embedders (ApiEmbedder, MiniLM, Bedrock). */
export async function buildVectorIndexAsync(store, embedder) {
  const index = new VectorIndex();
  for (const o of store.all()) {
    if (!EMBEDDABLE.has(o.__type)) continue;
    index.upsert(o.id, await embedder.embed(contextualText(store, o)), { label: o.label, type: o.__type });
  }
  return index;
}

