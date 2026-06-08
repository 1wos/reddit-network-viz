/**
 * Cohere adapters smoke test — verifies the v2 Embed + Rerank wiring WITHOUT a key,
 * using an injected fake fetch that asserts the request matches Cohere's documented
 * contract and returns documented-shaped responses.
 *   node scripts/cohere-smoke.mjs
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { CohereEmbedder, UpstageEmbedder, resolveEmbedder, defaultEmbedder } from "../src/ontology/embeddings/index.js";
import { CohereReranker, rerankCandidatesWithCohere } from "../src/ontology/rerank/cohereReranker.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) failed++; };
const json = (obj) => ({ ok: true, status: 200, async json() { return obj; }, async text() { return ""; } });

// ── Embed: assert payload shape + input_type passthrough, parse embeddings.float ──
let embedReq = null;
const fakeEmbedFetch = (url, init) => {
  embedReq = { url, body: JSON.parse(init.body) };
  return json({ embeddings: { float: [[3, 4]] } }); // unnormalized → embedder must L2-normalize
};
const emb = new CohereEmbedder({ apiKey: "test", fetch: fakeEmbedFetch });
ok(emb.available, "CohereEmbedder.available with key");
const qv = await emb.embed("query text"); // default input_type
ok(embedReq.url.endsWith("/v2/embed"), "embed hits /v2/embed");
ok(embedReq.body.model === "embed-v4.0", "embed uses embed-v4.0");
ok(embedReq.body.input_type === "search_query", "query embed → input_type=search_query (default)");
ok(JSON.stringify(embedReq.body.embedding_types) === '["float"]', "requests float embeddings");
await emb.embed("a document", "search_document");
ok(embedReq.body.input_type === "search_document", "doc embed → input_type=search_document (best practice)");
ok(Math.abs(Math.hypot(qv[0], qv[1]) - 1) < 1e-6, `vector L2-normalized (|v|=${Math.hypot(qv[0], qv[1]).toFixed(3)})`);

// ── Rerank: assert payload + reorder by relevance_score ──
let rerankReq = null;
const fakeRerankFetch = (url, init) => {
  rerankReq = { url, body: JSON.parse(init.body) };
  // documents in order [A,B,C]; Cohere returns them reordered by relevance:
  return json({ results: [{ index: 2, relevance_score: 0.9 }, { index: 0, relevance_score: 0.5 }, { index: 1, relevance_score: 0.1 }] });
};
const rr = new CohereReranker({ apiKey: "test", fetch: fakeRerankFetch });
const ranked = await rr.rerank("q", ["A", "B", "C"]);
ok(rerankReq.url.endsWith("/v2/rerank"), "rerank hits /v2/rerank");
ok(rerankReq.body.model === "rerank-v3.5", "rerank uses rerank-v3.5");
ok(rerankReq.body.query === "q" && rerankReq.body.documents.length === 3, "rerank sends query + documents");
ok(ranked[0].index === 2 && ranked[0].score === 0.9, "results ordered by relevance_score (top = index 2)");

// ── rerankCandidatesWithCohere reorders real candidate nodes ──
const store = createStore(buildUsFinanceDataset());
const cands = [{ id: "bitcoin" }, { id: "nvidia" }, { id: "interest_rates" }];
const reordered = await rerankCandidatesWithCohere(rr, store, "AI chips", cands);
ok(reordered[0].id === "interest_rates" && typeof reordered[0].cohereScore === "number",
  `candidates reordered by Cohere (top=${reordered[0].id}, score=${reordered[0].cohereScore})`);

// ── Upstage embedder: query/passage best practice expressed via MODEL NAME ──
let upReq = null;
const fakeUpFetch = (url, init) => { upReq = { url, body: JSON.parse(init.body) }; return json({ data: [{ embedding: [6, 8] }] }); };
const up = new UpstageEmbedder({ apiKey: "test", fetch: fakeUpFetch });
ok(up.available, "UpstageEmbedder.available with key");
const upv = await up.embed("a query");
ok(upReq.url.endsWith("/embeddings"), "upstage hits OpenAI-compatible /embeddings");
ok(upReq.body.model === "solar-embedding-1-large-query", "query → solar-embedding-1-large-query");
await up.embed("a document", "search_document");
ok(upReq.body.model === "solar-embedding-1-large-passage", "doc → solar-embedding-1-large-passage (best practice)");
ok(Math.abs(Math.hypot(upv[0], upv[1]) - 1) < 1e-6, "upstage vector L2-normalized");

// ── Graceful: no key → not available → resolveEmbedder falls back to deps-free ──
ok(!new CohereReranker({}).available, "no key → reranker.available=false (caller falls back)");
const { embedder, real } = resolveEmbedder({ provider: "cohere" }); // no COHERE_API_KEY in env
ok(embedder === defaultEmbedder && real === false, "no key → resolveEmbedder falls back to HashingEmbedder");

console.log(failed ? `\n❌ ${failed} failed` : "\n✅ ALL GREEN — External provider adapters (Cohere Embed+Rerank, Upstage Solar Embed, documented contracts + graceful fallback)");
process.exit(failed ? 1 : 0);
