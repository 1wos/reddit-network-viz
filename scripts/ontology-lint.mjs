/**
 * Ontology lint + Competency-Question coverage.
 *   node scripts/ontology-lint.mjs   (or: npm run lint:ontology)
 * Gates on schema/dangling errors and CQ coverage (every CQ must be answerable).
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { lintOntology } from "../src/ontology/lint.js";
import { runCQ } from "../eval/competencyQuestions.js";

const store = createStore(buildUsFinanceDataset());

// ── lint ──
const r = lintOntology(store);
console.log(`\n=== Ontology lint ===  nodes=${r.stats.nodes} links=${r.stats.links}`);
console.log(`errors=${r.errors.length}  warnings=${r.warnings.length}  info=${r.info.length}`);
for (const e of r.errors.slice(0, 8)) console.log(`  ❌ ${e.code}: ${JSON.stringify(e).slice(0, 100)}`);
const warnCounts = {};
for (const w of r.warnings) warnCounts[w.code] = (warnCounts[w.code] || 0) + 1;
for (const [c, n] of Object.entries(warnCounts)) console.log(`  ⚠ ${c}: ${n}`);
for (const i of r.info) console.log(`  · ${i.code}: ${i.type}`);

// ── competency questions ──
const cqs = runCQ(store);
const passed = cqs.filter((c) => c.pass).length;
console.log(`\n=== Competency Questions ===  ${passed}/${cqs.length} answerable`);
for (const c of cqs) console.log(`  ${c.pass ? "✅" : "❌"} ${c.id} ${c.q}  → ${c.count} (${c.sample.join(", ")})`);

// ── gate ──
const cqGap = cqs.filter((c) => !c.pass);
let failed = 0;
if (r.errors.length) { console.log(`\n❌ ${r.errors.length} lint error(s)`); failed++; }
if (cqGap.length) { console.log(`❌ ${cqGap.length} competency gap(s): ${cqGap.map((c) => c.id).join(", ")}`); failed++; }
console.log(failed ? "" : "\n✅ ONTOLOGY HEALTHY — 0 design errors, all competency questions answerable");
process.exit(failed ? 1 : 0);
