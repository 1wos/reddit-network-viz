# Cohere integration — Embed + Rerank (grounded in the official docs)

Cohere plugs into two places in the retrieval stack, both behind a `COHERE_API_KEY`
with graceful fallback to the deps-free path when absent. The adapters follow
Cohere's documented v2 contract and best practices — not guessed shapes.

> Sources: [Embed reference](https://docs.cohere.com/reference/embed) ·
> [Rerank reference](https://docs.cohere.com/reference/rerank)

## 1. Embeddings (③ real embeddings)

[`src/ontology/embeddings/cohereEmbedder.js`](../src/ontology/embeddings/cohereEmbedder.js) —
`POST https://api.cohere.com/v2/embed`, model `embed-v4.0`, response at `embeddings.float`.

**Best practice applied — `input_type` (Cohere-specific, materially affects recall):**
- stored documents are embedded with `input_type: "search_document"`
- the search query is embedded with `input_type: "search_query"`

The `EmbeddingProvider` interface is `embed(text, inputType)`; `buildVectorIndexAsync`
passes `"search_document"`, query-time callers default to `"search_query"`. The other
providers (Hashing/OpenAI-compatible) ignore the 2nd arg, so the interface stays uniform.
Vectors are L2-normalized so cosine == dot (matches `VectorIndex`).

Select it via `resolveEmbedder({ provider: "cohere" })` or `EMBED_PROVIDER=cohere`.

## 2. Rerank (② KG-RAG vector-reranking upgrade)

[`src/ontology/rerank/cohereReranker.js`](../src/ontology/rerank/cohereReranker.js) —
`POST https://api.cohere.com/v2/rerank`, model `rerank-v3.5`, response
`results: [{ index, relevance_score }]` with score normalized to `[0,1]`; documents
capped at Cohere's recommended **≤ 1000** per request.

KG-RAG stage 3 (`rerankByVector`) reorders graph-expanded candidates with a
deterministic *vector-sim × graph-weight* blend. When a key is present,
`rerankCandidatesWithCohere(...)` swaps in Cohere's purpose-built cross-encoder
reranker — strictly stronger query↔document relevance signal — over the candidates'
contextual text. No key → the deterministic blend stands.

## Why keyless-by-default still holds

Both adapters are **server-side / scripts only** — a key never reaches the browser.
With no key, retrieval runs on the deps-free `HashingEmbedder` + heuristic rerank, so
the demo and CI stay fully offline. The Cohere path is a measurable upgrade, not a
dependency.

## Run

```bash
node scripts/cohere-smoke.mjs        # offline: asserts the documented contract (no key)
COHERE_API_KEY=…  npm run cohere:live # live: real embed + rerank vs the baseline
```
