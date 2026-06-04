/**
 * LLM — pluggable LLMProvider
 *
 * Interface: `available: boolean`, `async generate({ system, user }) -> string`.
 *
 * Default = NullLLM (no key) → the engine stays fully deterministic and the demo
 * runs offline. ClaudeLLM / BedrockLLM are real adapters (lazy-loaded) that
 * activate when a key/SDK is present, so the LLM answer-synthesis and extraction
 * paths use the SAME grounded contract — no caller changes.
 */

export class NullLLM {
  get available() { return false; }
  async generate() { throw new Error("no LLM configured (NullLLM)"); }
}

/** Anthropic Claude adapter. Enable with: npm i @anthropic-ai/sdk + ANTHROPIC_API_KEY. */
export class ClaudeLLM {
  constructor(opts = {}) {
    this.model = opts.model || "claude-sonnet-4-6";
    this.apiKey = opts.apiKey || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY : null);
    this.maxTokens = opts.maxTokens || 700;
  }
  get available() { return !!this.apiKey; }
  async generate({ system, user }) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk"); // lazy; install to enable
    const client = new Anthropic({ apiKey: this.apiKey });
    const msg = await client.messages.create({
      model: this.model, max_tokens: this.maxTokens, system,
      messages: [{ role: "user", content: user }],
    });
    return msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  }
}

/**
 * OpenAI-compatible chat adapter (fetch-only, no SDK). Works with any provider
 * exposing /chat/completions: Moonshot/Kimi, OpenAI, Together, Groq, etc.
 */
export class OpenAICompatibleLLM {
  constructor({ apiKey, baseURL, model, maxTokens = 700, temperature = 0.3 } = {}) {
    this.apiKey = apiKey;
    this.baseURL = (baseURL || "").replace(/\/$/, "");
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
  }
  get available() { return !!this.apiKey; }
  async generate({ system, user }) {
    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model, max_tokens: this.maxTokens, temperature: this.temperature,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const d = await res.json();
    const msg = d.choices?.[0]?.message || {};
    const out = (msg.content || msg.reasoning_content || "").trim(); // some reasoning models use reasoning_content
    if (!out) throw new Error("empty completion");
    return out;
  }
}

/** Moonshot / Kimi (OpenAI-compatible). Set MOONSHOT_API_KEY (+ optional MOONSHOT_BASE_URL/MODEL). */
export class KimiLLM extends OpenAICompatibleLLM {
  constructor(opts = {}) {
    const env = typeof process !== "undefined" ? process.env : {};
    super({
      apiKey: opts.apiKey || env.MOONSHOT_API_KEY || env.KIMI_API_KEY,
      baseURL: opts.baseURL || env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1",
      model: opts.model || env.MOONSHOT_MODEL || "moonshot-v1-8k",
      maxTokens: opts.maxTokens || Number(env.MOONSHOT_MAX_TOKENS) || 4096, // headroom for reasoning models (K2.5)
      temperature: opts.temperature ?? 1, // Kimi K2.5 requires temperature=1
    });
  }
}

const _env = () => (typeof process !== "undefined" ? process.env : {});

/**
 * Provider registry — every entry is OpenAI-compatible, so one adapter serves
 * all. `free` marks providers with a usable free tier. Override per provider
 * with <NAME>_API_KEY / <NAME>_BASE_URL / <NAME>_MODEL env vars.
 */
export const PROVIDERS = {
  // — paid / credit —
  openai:     { keyEnv: ["OPENAI_API_KEY"],     base: "https://api.openai.com/v1",        model: "gpt-4o-mini" },
  deepseek:   { keyEnv: ["DEEPSEEK_API_KEY"],   base: "https://api.deepseek.com",         model: "deepseek-chat" },
  grok:       { keyEnv: ["XAI_API_KEY", "GROK_API_KEY"], base: "https://api.x.ai/v1",      model: "grok-3", aliases: ["xai"] },
  kimi:       { keyEnv: ["MOONSHOT_API_KEY", "KIMI_API_KEY"], base: "https://api.moonshot.ai/v1", model: "kimi-k2.5", temperature: 1, maxTokens: 4096, aliases: ["moonshot"] },
  qwen:       { keyEnv: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"], base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  // Kakao Kanana-o (CBT). Korean-specialized multimodal. Endpoint/format unconfirmed —
  // override KANANA_BASE_URL / KANANA_MODEL with the official CBT docs when issued.
  kanana:     { keyEnv: ["KANANA_API_KEY"], base: "https://api-omni.kanana.ai/v1", model: "kanana-1.5-o-9.8b-2602", aliases: ["kakao"] },
  doubao:     { keyEnv: ["ARK_API_KEY", "DOUBAO_API_KEY"], base: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-pro-32k", aliases: ["bytedance", "volcano"] },
  // — free tier —
  mistral:    { keyEnv: ["MISTRAL_API_KEY"],    base: "https://api.mistral.ai/v1",        model: "mistral-large-latest", free: true }, // ~1B tokens/mo free
  groq:       { keyEnv: ["GROQ_API_KEY"],       base: "https://api.groq.com/openai/v1",   model: "llama-3.3-70b-versatile", free: true },
  sambanova:  { keyEnv: ["SAMBANOVA_API_KEY"],  base: "https://api.sambanova.ai/v1",       model: "Meta-Llama-3.3-70B-Instruct", free: true },
  github:     { keyEnv: ["GITHUB_TOKEN", "GITHUB_MODELS_TOKEN"], base: "https://models.github.ai/inference", model: "gpt-4o-mini", free: true, aliases: ["githubmodels"] },
  gemini:     { keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", free: true, aliases: ["google"] },
  cerebras:   { keyEnv: ["CEREBRAS_API_KEY"],   base: "https://api.cerebras.ai/v1",        model: "llama-3.3-70b", free: true },
  openrouter: { keyEnv: ["OPENROUTER_API_KEY"], base: "https://openrouter.ai/api/v1",      model: "meta-llama/llama-3.3-70b-instruct:free", free: true },
  // — local / free, no key —
  ollama:     { keyEnv: [], base: "http://localhost:11434/v1", model: "llama3.2", local: true, free: true },
};

const resolveProvider = (name) => {
  const k = (name || "").toLowerCase();
  if (PROVIDERS[k]) return [k, PROVIDERS[k]];
  for (const [key, p] of Object.entries(PROVIDERS)) if (p.aliases?.includes(k)) return [key, p];
  return [null, null];
};

/**
 * Factory — pick a provider by name (env LLM_PROVIDER). Provider-agnostic:
 * 12+ OpenAI-compatible backends + Claude (anthropic SDK). Returns NullLLM if
 * the provider is unknown or its key is missing.
 */
export function makeLLM(provider = "kimi", opts = {}) {
  const name = (provider || "").toLowerCase();
  if (name === "claude" || name === "anthropic") return new ClaudeLLM(opts);
  const [key, p] = resolveProvider(name);
  if (!p) return new NullLLM();
  const env = _env();
  const PFX = key.toUpperCase();
  const apiKey = opts.apiKey || p.keyEnv.map((e) => env[e]).find(Boolean) || (p.local ? "local" : undefined);
  return new OpenAICompatibleLLM({
    apiKey,
    baseURL: opts.baseURL || env[`${PFX}_BASE_URL`] || p.base,
    model: opts.model || env[`${PFX}_MODEL`] || p.model,
    temperature: opts.temperature ?? p.temperature ?? 0.3,
    maxTokens: opts.maxTokens || p.maxTokens || 700,
  });
}

/**
 * AWS Bedrock adapter (documented swap — ties the project to the AWS bullet):
 *   class BedrockLLM {
 *     constructor(o){ this.model = o.model || "anthropic.claude-3-5-sonnet-20241022-v2:0"; }
 *     get available(){ return !!process.env.AWS_REGION; }
 *     async generate({system,user}){
 *       const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
 *       const c = new BedrockRuntimeClient({});
 *       const body = JSON.stringify({ anthropic_version:"bedrock-2023-05-31", max_tokens:700,
 *         system, messages:[{role:"user",content:user}] });
 *       const r = await c.send(new InvokeModelCommand({ modelId:this.model, body }));
 *       return JSON.parse(new TextDecoder().decode(r.body)).content.map(b=>b.text).join("");
 *     }
 *   }
 *  Bedrock Titan embeddings can likewise back the EmbeddingProvider interface.
 */

export const defaultLLM = new NullLLM();
