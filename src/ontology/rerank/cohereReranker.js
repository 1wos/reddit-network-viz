/**
 * CohereReranker — query-aware reranking via Cohere's v2 /rerank API.
 *
 * Grounded in the official reference (https://docs.cohere.com/reference/rerank):
 *   POST https://api.cohere.com/v2/rerank
 *   body: { model, query, documents:[str], top_n? }
 *   resp: { results: [{ index, relevance_score }] }   // score normalized [0,1]
 *   limit: ≤ 1000 documents per call.
 *
 * This is a purpose-built cross-encoder reranker — strictly better signal than the
 * deterministic `rerankByVector` blend — so it UPGRADES KG-RAG stage 3 when a
 * COHERE_API_KEY is configured, and the code falls back to the heuristic otherwise.
 * Server-side / scripts only (the key must never reach the browser).
 */
import { contextualText } from "../embeddings/contextualText.js";

const MAX_DOCS = 1000; // Cohere's recommended per-request ceiling.

export class CohereReranker {
  constructor(opts = {}) {
    const env = typeof process !== "undefined" ? process.env : {};
    this.apiKey = opts.apiKey || env.COHERE_API_KEY;
    this.model = opts.model || env.COHERE_RERANK_MODEL || "rerank-v3.5";
    this.baseURL = (opts.baseURL || env.COHERE_BASE_URL || "https://api.cohere.com").replace(/\/$/, "");
    this._fetch = opts.fetch || (typeof fetch !== "undefined" ? fetch : null); // injectable for tests
  }

  get available() { return !!this.apiKey; }

  /**
   * Rank `documents` (array of strings) against `query`.
   * @returns [{ index, score }] ordered by relevance (index = position in input).
   */
  async rerank(query, documents, opts = {}) {
    if (!this._fetch) throw new Error("no fetch available");
    const docs = documents.slice(0, MAX_DOCS);
    const body = { model: this.model, query, documents: docs };
    if (opts.topN) body.top_n = opts.topN;
    const res = await this._fetch(`${this.baseURL}/v2/rerank`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`cohere rerank ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    return d.results.map((r) => ({ index: r.index, score: r.relevance_score }));
  }
}

/**
 * Rerank a graph-expanded candidate set (nodes with `.id`) against the query using
 * Cohere — the real-reranker equivalent of `rerankByVector`. Each candidate's
 * document text is its contextual embedding text (label + graph neighborhood).
 * Returns the candidates reordered, annotated with `cohereScore`.
 */
export async function rerankCandidatesWithCohere(reranker, store, query, candidates) {
  if (!reranker?.available || !candidates?.length) return candidates;
  const docs = candidates.map((c) => contextualText(store, store.get(c.id) || c));
  const ranked = await reranker.rerank(query, docs);
  return ranked.map((r) => ({ ...candidates[r.index], cohereScore: Math.round(r.score * 1000) / 1000 }));
}
