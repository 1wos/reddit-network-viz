/**
 * Embeddings — facade: build a contextual vector index over a store and run
 * semantic search. Provider- and index-agnostic (HashingEmbedder + VectorIndex
 * by default; swap for MiniLM/Bedrock + pgvector/OpenSearch via the same calls).
 */

import { HashingEmbedder, defaultEmbedder } from "./provider.js";
import { ApiEmbedder } from "./apiEmbedder.js";
import { CohereEmbedder } from "./cohereEmbedder.js";
import { UpstageEmbedder } from "./upstageEmbedder.js";
import { VectorIndex } from "../vector/vectorIndex.js";
import { contextualText } from "./contextualText.js";

export { HashingEmbedder, defaultEmbedder, ApiEmbedder, CohereEmbedder, UpstageEmbedder, contextualText, VectorIndex };

/**
 * Pick a REAL semantic embedder when an API key is configured, else fall back to
 * the deps-free HashingEmbedder. `provider: "cohere"` selects Cohere (its API is
 * not OpenAI-shaped); anything else uses the OpenAI-compatible ApiEmbedder.
 * Returns `{ embedder, real }` — `real: true` means semantic embeddings are
 * active. Server-side / scripts only; the browser stays keyless by design.
 */
export function resolveEmbedder(opts = {}) {
  const env = typeof process !== "undefined" ? process.env : {};
  const provider = opts.provider || env.EMBED_PROVIDER;
  if (provider === "cohere") {
    const c = new CohereEmbedder(opts);
    if (c.available) return { embedder: c, real: true };
  }
  if (provider === "upstage" || provider === "solar") {
    const u = new UpstageEmbedder(opts);
    if (u.available) return { embedder: u, real: true };
  }
  const api = new ApiEmbedder(opts);
  return api.available ? { embedder: api, real: true } : { embedder: defaultEmbedder, real: false };
}

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

/**
 * KG-RAG Vector Reranking (slide 33, stage 3): reorder a graph-expanded candidate
 * set by relevance to the query. Each candidate's score blends its graph signal
 * (`props.weight`) with the cosine similarity of its contextual embedding to the
 * query — so the most query-relevant expanded nodes rise, not just the
 * highest-weighted edges. Pure reorder (no drops); annotates `vsim`/`rerankScore`.
 * @param alpha weight on the graph signal vs the vector signal (default 0.5).
 */
export function rerankByVector(index, query, candidates, opts = {}) {
  const embedder = opts.embedder || defaultEmbedder;
  const alpha = opts.alpha ?? 0.5;
  if (!index || !candidates?.length) return candidates;
  const qv = embedder.embed(query);
  return candidates
    .map((c) => {
      const vsim = Math.max(0, index.similarityTo(c.id, qv));
      const gw = c.props?.weight ?? 0.5;
      return { ...c, vsim: Math.round(vsim * 1000) / 1000, rerankScore: Math.round((alpha * gw + (1 - alpha) * vsim) * 1000) / 1000 };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}

/** Async index build for API/remote embedders (ApiEmbedder, Cohere, MiniLM, Bedrock).
    Stored texts are embedded with input_type "search_document" (Cohere best practice;
    ignored by providers that don't distinguish doc vs query). */
export async function buildVectorIndexAsync(store, embedder) {
  const index = new VectorIndex();
  for (const o of store.all()) {
    if (!EMBEDDABLE.has(o.__type)) continue;
    index.upsert(o.id, await embedder.embed(contextualText(store, o), "search_document"), { label: o.label, type: o.__type });
  }
  return index;
}

