/**
 * Engine smoke test — exercises the GraphRAG pipeline end to end:
 * intent match → slot fill → subgraph → evidence bundle → support assessment.
 *   node scripts/ontology-engine-smoke.mjs
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { answerWithGraphRAG, ENGINE_QUESTIONS } from "../src/ontology/engine/index.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) failed++; };

const store = createStore(buildUsFinanceDataset());

const expectIntent = {
  "Why is NVIDIA trending across finance and technology communities?": "why_trending",
  "Which topics are causing negative sentiment around Bitcoin?": "negative_drivers",
  "What market risks are emerging from Reddit discussions?": "emerging_risks",
  "Which companies are connected to AI datacenter discussions?": "connected_orgs",
  "How do interest rates affect Bitcoin?": "impact_path",
};

for (const q of ENGINE_QUESTIONS) {
  const a = answerWithGraphRAG(store, q);
  const slotsFilled = Object.entries(a.slots).filter(([, v]) => v.length).map(([k, v]) => `${k}:${v.length}`);
  console.log(`\n— "${q}"`);
  console.log(`   intent=${a.intent.id} support=${a.supportStatus} conf=${a.confidence} ctx=${a.context.hash}`);
  console.log(`   slots: ${slotsFilled.join("  ") || "(none)"}`);
  console.log(`   evidence: ${a.evidence.length}  related: ${a.relatedNodes.length}  missing: ${JSON.stringify(a.missingSlots)}`);
  console.log(`   » ${a.summary}`);

  ok(a.intent.id === expectIntent[q], `intent = ${expectIntent[q]}`);
  ok(["supported", "partial", "unsupported"].includes(a.supportStatus), "supportStatus 유효");
  ok(a.relatedNodes.length > 0 || a.path, "관련 노드/경로 채워짐");
  ok(typeof a.context.hash === "string", "ontology context 해시 동반");
}

// Targeted checks
const why = answerWithGraphRAG(store, "Why is NVIDIA trending across finance and technology communities?");
ok(why.anchors[0].id === "nvidia", "앵커 해소 = nvidia");
ok(why.supportStatus === "supported" && why.evidence.length > 0, "why_trending = supported (근거 동반)");

const neg = answerWithGraphRAG(store, "Which topics are causing negative sentiment around Bitcoin?");
ok(neg.slots.bearish_impacts?.every((n) => n.props?.polarity === "negative"), "negative_drivers = polarity=negative 링크만");

const path = answerWithGraphRAG(store, "How do interest rates affect Bitcoin?");
ok(path.path && path.path[0].id === "interest_rates" && path.path.at(-1).id === "bitcoin",
  `impact_path 경로: ${path.path?.map((s) => s.id).join(" → ")}`);

// Unsupported honesty: a question with no graph anchor should degrade, not fabricate
const none = answerWithGraphRAG(store, "Why is the weather nice today?");
ok(["partial", "unsupported"].includes(none.supportStatus), `근거 없는 질문 → support=${none.supportStatus} (날조 안 함)`);

console.log(failed ? `\n❌ ${failed} 실패` : "\n✅ ALL GREEN — GraphRAG 엔진 (intent→slot→subgraph→evidence→grounded+support) 통과");
process.exit(failed ? 1 : 0);
