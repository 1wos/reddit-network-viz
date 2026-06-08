/**
 * UpstageEmbedder — real semantic embeddings via Upstage Solar (Korean frontier).
 *
 * Grounded in the official reference (https://developers.upstage.ai/docs/apis/embeddings):
 *   POST https://api.upstage.ai/v1/embeddings   (OpenAI-compatible: { model, input } → data[0].embedding)
 *   4096-dim vectors.
 *
 * BEST PRACTICE (Upstage expresses query-vs-document via MODEL NAME, not a param):
 *   - documents → "solar-embedding-1-large-passage"
 *   - queries   → "solar-embedding-1-large-query"
 * The shared `embed(text, inputType)` 2nd arg selects the right model, mirroring
 * Cohere's input_type. Vectors are L2-normalized so cosine == dot (VectorIndex).
 * Server-side / scripts only.
 */
function l2norm(v) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export class UpstageEmbedder {
  constructor(opts = {}) {
    const env = typeof process !== "undefined" ? process.env : {};
    this.apiKey = opts.apiKey || env.UPSTAGE_API_KEY;
    this.baseURL = (opts.baseURL || env.UPSTAGE_BASE_URL || "https://api.upstage.ai/v1").replace(/\/$/, "");
    this.queryModel = opts.queryModel || env.UPSTAGE_EMBED_QUERY_MODEL || "solar-embedding-1-large-query";
    this.passageModel = opts.passageModel || env.UPSTAGE_EMBED_PASSAGE_MODEL || "solar-embedding-1-large-passage";
    this._fetch = opts.fetch || (typeof fetch !== "undefined" ? fetch : null); // injectable for tests
  }

  get available() { return !!this.apiKey; }

  async embed(text, inputType = "search_query") {
    if (!this._fetch) throw new Error("no fetch available");
    const model = inputType === "search_document" ? this.passageModel : this.queryModel;
    const res = await this._fetch(`${this.baseURL}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) throw new Error(`upstage embed ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    return l2norm(d.data[0].embedding);
  }
}
