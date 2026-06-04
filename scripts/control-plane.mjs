/**
 * Ontology Control Plane demo — emit signals, compile a profile, and compare a
 * baseline (full hybrid+vocab retrieval) vs a degraded candidate (lexical-only,
 * no vocab) to show promote/rollback decisioning.
 *   node scripts/control-plane.mjs   (or: npm run profile)
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { buildVectorIndex } from "../src/ontology/embeddings/index.js";
import { buildProfile, compareProfiles } from "../src/ontology/controlPlane.js";
import { GOLDEN_SET } from "../eval/goldenset.js";
import { PARAPHRASE_SET, ADVERSARIAL } from "../eval/paraphraseSet.js";

const store = createStore(buildUsFinanceDataset());
const index = buildVectorIndex(store);
const questions = [...GOLDEN_SET.map((g) => g.q), ...PARAPHRASE_SET.map((p) => p.q), ...ADVERSARIAL];

// baseline: full retrieval (hybrid + vocabulary)
const baseline = buildProfile(store, { questions, opts: { index }, label: "baseline" });
// candidate: degraded retrieval (lexical only, no alias vocab)
const candidate = buildProfile(store, { questions, opts: { index, lexicalOnly: true, vocab: null }, label: "lexical-only" });

const show = (p) => {
  console.log(`\n● profile ${p.profileId}  status=${p.status}  signals=${p.signalCount}  (err=${p.severity.error} warn=${p.severity.warn} info=${p.severity.info})`);
  for (const [t, n] of Object.entries(p.signalSummary).sort((a, b) => b[1] - a[1])) console.log(`    ${t.padEnd(28)} ${n}`);
};
console.log("=== Ontology Control Plane — run profiles ===");
show(baseline);
show(candidate);

const cmp = compareProfiles(baseline, candidate);
console.log(`\n=== baseline → candidate (degraded retrieval) ===`);
console.log(`severityDelta: ${JSON.stringify(cmp.severityDelta)}`);
for (const [k, d] of Object.entries(cmp.diff)) console.log(`  ${k.padEnd(28)} ${d.baseline} → ${d.candidate}  (${d.delta >= 0 ? "+" : ""}${d.delta})`);
console.log(`\n🧭 recommendation: ${cmp.recommendation.toUpperCase()}  ← control plane catches the regression automatically`);
