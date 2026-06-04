/**
 * Embeddings — pluggable EmbeddingProvider
 *
 * Interface: `embed(text) -> Float32Array (L2-normalized)`, `dim`.
 *
 * Default = HashingEmbedder: a deterministic, dependency-free feature-hashing
 * embedder (word + char-trigram features). It works everywhere (browser/node,
 * no API key) so the vector-retrieval architecture is demonstrable offline.
 * Swap in a real semantic model in production via the SAME interface — see
 * TransformersEmbedder / BedrockEmbedder notes below. Cosine similarity is just
 * a dot product because every vector is L2-normalized.
 */

function fnv1a(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Stopwords removed before hashing — they add cross-document noise that
   inflates spurious similarity (the main failure mode of bag-of-words vectors). */
const STOP = new Set(("a an the and or but of to in on for with at by from as is are was were be been it its that this these those " +
  "how does do did what which when where why who whom into than then so such not no can could would should will may might " +
  "about over under up down out off again more most some any all each both because while during against between has have had").split(" "));

function tokenize(text) {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 2 && !STOP.has(w));
  const toks = [];
  for (const w of words) {
    toks.push(w);                                   // whole word
    if (w.length >= 4) for (let i = 0; i <= w.length - 3; i++) toks.push("#" + w.slice(i, i + 3)); // char trigrams (morphology)
  }
  return toks;
}

export class HashingEmbedder {
  constructor(dim = 256) { this.dim = dim; }

  embed(text) {
    const v = new Float32Array(this.dim);
    const counts = new Map();
    for (const t of tokenize(text || "")) counts.set(t, (counts.get(t) || 0) + 1);
    for (const [t, c] of counts) {
      const h = fnv1a(t);
      const idx = h % this.dim;
      const sign = (h >>> 16) & 1 ? 1 : -1;       // signed feature hashing reduces collisions
      v[idx] += sign * (1 + Math.log(c));          // sublinear term frequency
    }
    let n = 0;
    for (let i = 0; i < this.dim; i++) n += v[i] * v[i];
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < this.dim; i++) v[i] /= n;
    return v;
  }
}

/**
 * Production swap (same interface) — kept as a documented adapter, lazily loaded
 * so the default build needs no heavy dependency:
 *
 *   class TransformersEmbedder {                 // local MiniLM, no API key
 *     async init() { const { pipeline } = await import("@huggingface/transformers");
 *       this.pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2"); this.dim = 384; }
 *     async embed(text) { const o = await this.pipe(text, { pooling: "mean", normalize: true }); return o.data; }
 *   }
 *
 *   class BedrockEmbedder { /* AWS Bedrock Titan / Cohere embeddings via SDK *​/ }
 *
 * The vector index + retrieval code is provider-agnostic, so swapping is a
 * one-line change at the call site.
 */

export const defaultEmbedder = new HashingEmbedder();
