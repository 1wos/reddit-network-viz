/**
 * Vector — in-memory cosine VectorIndex
 *
 * A minimal, provider-agnostic vector store: upsert (id, vector, meta) and
 * search (query vector → top-k by cosine). Vectors are assumed L2-normalized,
 * so cosine == dot product. This is the same contract a production vector DB
 * exposes — swap the class body for a pgvector / OpenSearch / Pinecone client
 * (upsert → INSERT/ANN write, search → `ORDER BY embedding <=> $1 LIMIT k`)
 * without touching callers.
 */

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export class VectorIndex {
  constructor() { this.items = []; }

  upsert(id, vector, meta = {}) {
    const i = this.items.findIndex((x) => x.id === id);
    const rec = { id, vector, meta };
    if (i >= 0) this.items[i] = rec; else this.items.push(rec);
    return this;
  }

  search(queryVector, k = 5) {
    return this.items
      .map((it) => ({ id: it.id, score: dot(queryVector, it.vector), meta: it.meta }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /** Stored vector for an id (or null) — lets callers rerank a known candidate set. */
  vectorOf(id) {
    const it = this.items.find((x) => x.id === id);
    return it ? it.vector : null;
  }

  /** Cosine similarity of a query vector against a stored id (0 if absent). */
  similarityTo(id, queryVector) {
    const v = this.vectorOf(id);
    return v ? dot(queryVector, v) : 0;
  }

  get size() { return this.items.length; }
}
