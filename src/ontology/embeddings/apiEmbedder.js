/**
 * ApiEmbedder — real semantic embeddings via any OpenAI-compatible /embeddings
 * endpoint (OpenAI text-embedding-3, Mistral, Gemini, Cohere, …). Same
 * EmbeddingProvider interface as HashingEmbedder, so it drops into
 * buildVectorIndexAsync without touching retrieval code.
 *
 * Swapping the deps-free HashingEmbedder for this is the single biggest
 * retrieval-recall lever (see docs/REVIEW_BOTTLENECKS.md #1). Vectors are
 * L2-normalized so cosine == dot product, matching VectorIndex.
 */
const PRESETS = {
  openai: { base: "https://api.openai.com/v1", model: "text-embedding-3-small", keyEnv: "OPENAI_API_KEY" },
  mistral: { base: "https://api.mistral.ai/v1", model: "mistral-embed", keyEnv: "MISTRAL_API_KEY" },
  gemini: { base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-embedding-001", keyEnv: "GEMINI_API_KEY" },
};

function l2norm(v) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export class ApiEmbedder {
  constructor(opts = {}) {
    const env = typeof process !== "undefined" ? process.env : {};
    const p = PRESETS[opts.provider] || {};
    this.baseURL = (opts.baseURL || env.EMBED_BASE_URL || p.base || "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = opts.model || env.EMBED_MODEL || p.model || "text-embedding-3-small";
    this.apiKey = opts.apiKey || env.EMBED_API_KEY || (p.keyEnv && env[p.keyEnv]);
  }
  get available() { return !!this.apiKey; }

  async embed(text) {
    const res = await fetch(`${this.baseURL}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    return l2norm(d.data[0].embedding);
  }
}
