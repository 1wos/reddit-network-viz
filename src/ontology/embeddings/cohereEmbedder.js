/**
 * CohereEmbedder — real semantic embeddings via Cohere's v2 /embed API.
 *
 * Grounded in the official reference (https://docs.cohere.com/reference/embed):
 *   POST https://api.cohere.com/v2/embed
 *   body: { model, texts:[…], input_type, embedding_types:["float"] }
 *   resp: { embeddings: { float: [[…]] } }
 *
 * BEST PRACTICE (Cohere-specific, materially affects recall): `input_type` MUST be
 *   - "search_document" for the texts you store in the index, and
 *   - "search_query"    for the query you search with.
 * So `embed(text, inputType)` takes the type as a second arg; buildVectorIndexAsync
 * passes "search_document" and query-time callers default to "search_query". The
 * other providers (Hashing/Api) ignore the 2nd arg, so the interface stays uniform.
 *
 * Vectors are L2-normalized so cosine == dot (matches VectorIndex). Server-side /
 * scripts only — never ship a key to the browser.
 */
function l2norm(v) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export class CohereEmbedder {
  constructor(opts = {}) {
    const env = typeof process !== "undefined" ? process.env : {};
    this.apiKey = opts.apiKey || env.COHERE_API_KEY;
    this.model = opts.model || env.COHERE_EMBED_MODEL || "embed-v4.0";
    this.baseURL = (opts.baseURL || env.COHERE_BASE_URL || "https://api.cohere.com").replace(/\/$/, "");
    this._fetch = opts.fetch || (typeof fetch !== "undefined" ? fetch : null); // injectable for tests
  }

  get available() { return !!this.apiKey; }

  async embed(text, inputType = "search_query") {
    if (!this._fetch) throw new Error("no fetch available");
    const res = await this._fetch(`${this.baseURL}/v2/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, texts: [text], input_type: inputType, embedding_types: ["float"] }),
    });
    if (!res.ok) throw new Error(`cohere embed ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    return l2norm(d.embeddings.float[0]);
  }
}
