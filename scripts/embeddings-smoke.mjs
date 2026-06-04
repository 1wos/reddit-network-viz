/**
 * Embeddings / vector retrieval smoke test (M3).
 *   node scripts/embeddings-smoke.mjs
 * Verifies contextual embeddings, semantic search relevance, and HYBRID
 * (lexical→semantic) anchor retrieval — while preserving no-fabrication.
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { buildVectorIndex, semanticSearch } from "../src/ontology/embeddings/index.js";
import { contextualText } from "../src/ontology/embeddings/contextualText.js";
import { answerWithGraphRAG } from "../src/ontology/engine/index.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) failed++; };

const store = createStore(buildUsFinanceDataset());
const index = buildVectorIndex(store);
ok(index.size >= 30, `벡터 인덱스 구축: ${index.size} contextual embeddings`);

// contextual text includes graph neighborhood (not just the label)
const ctx = contextualText(store, store.get("nvidia"));
ok(/Related:/.test(ctx) && /(TSMC|Semiconductor|Datacenter)/.test(ctx), `contextual text가 이웃 포함: "${ctx.slice(0, 90)}…"`);

// semantic search relevance (paraphrase, no exact label)
const s1 = semanticSearch(index, "central bank monetary policy and the rate path", 5).map((h) => h.id);
console.log("   q='central bank monetary policy…' →", s1.join(", "));
ok(s1.includes("interest_rates") || s1.includes("federal_reserve"), "rates/Fed 의미검색 적중");

const s2 = semanticSearch(index, "GPU chips for training large AI models", 5).map((h) => h.id);
console.log("   q='GPU chips for AI training…' →", s2.join(", "));
ok(s2.some((id) => ["nvidia", "semiconductor", "h100_gpu", "blackwell_gpu", "ai_datacenter"].includes(id)), "AI칩 의미검색 적중");

// HYBRID anchor retrieval: paraphrase with NO exact entity label/word
const hybrid = answerWithGraphRAG(store, "Which suppliers enable large-scale compute buildouts?", { index });
console.log(`   q='suppliers enable large-scale compute buildouts' → retrieval=${hybrid.retrieval} anchor=${hybrid.anchors[0]?.label} support=${hybrid.supportStatus}`);
ok(hybrid.retrieval === "semantic" && hybrid.grounded, "어휘 미스 → 벡터 폴백으로 grounded");

// lexical still wins when exact (no regression)
const lex = answerWithGraphRAG(store, "Why is NVIDIA trending?", { index });
ok(lex.retrieval === "lexical" && lex.supportStatus === "supported", "정확 매칭은 여전히 lexical/supported");

// no-fabrication preserved even WITH an index (threshold)
const none = answerWithGraphRAG(store, "Why is the weather nice today?", { index });
ok(none.supportStatus === "unsupported", `근거 없는 질문 → ${none.supportStatus} (벡터도 임계값 미달, 날조 안 함)`);

console.log(failed ? `\n❌ ${failed} 실패` : "\n✅ ALL GREEN — Contextual embeddings + 벡터 + 하이브리드 retrieval 통과");
process.exit(failed ? 1 : 0);
