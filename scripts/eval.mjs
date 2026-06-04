/**
 * GraphRAG evaluation — prints a scorecard over the golden set.
 *   node scripts/eval.mjs   (or: npm run eval)
 * Exits non-zero if any metric falls below its threshold (CI gate).
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { buildVectorIndex } from "../src/ontology/embeddings/index.js";
import { GOLDEN_SET } from "../eval/goldenset.js";
import { runEval } from "../eval/harness.js";

const store = createStore(buildUsFinanceDataset());
const index = buildVectorIndex(store);
const { rows, scorecard } = runEval(store, index, GOLDEN_SET);

// per-case table
console.log("\nGraphRAG eval — per case:");
for (const r of rows) {
  console.log(`  ${r.q.padEnd(48)} ${r.support.padEnd(22)} intent=${r.intent.padEnd(18)} anchorR=${String(r.anchorR).padEnd(6)} rel=${r.related} path=${r.path} faith=${r.faith}`);
}

console.log("\n── Scorecard (n=" + scorecard.n + ") ──");
const THRESH = { intentAccuracy: 90, anchorRecall: 90, relatedRecallAtK: 80, supportAccuracy: 80, noFabricationRate: 100, citationFaithfulness: 90 };
let failed = 0;
for (const [k, v] of Object.entries(scorecard)) {
  if (k === "n") continue;
  const t = THRESH[k];
  const ok = v >= t;
  if (!ok) failed++;
  console.log(`  ${ok ? "✅" : "❌"} ${k.padEnd(22)} ${String(v).padStart(5)}%   (threshold ${t}%)`);
}

console.log(failed ? `\n❌ ${failed} metric(s) below threshold` : "\n✅ ALL METRICS PASS — engine quality measured & gated");
process.exit(failed ? 1 : 0);
