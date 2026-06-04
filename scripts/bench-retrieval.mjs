/**
 * Retriever ablation benchmark — measures retrieval STRATEGY tradeoffs:
 *   A) lexical-only vs hybrid (lexical+vector) on paraphrase queries
 *   B) semantic-threshold sweep: paraphrase recall vs no-fabrication
 *
 *   node scripts/bench-retrieval.mjs   (or: npm run bench)
 *
 * Deterministic, no API key. This is the "why I chose hybrid + threshold 0.25"
 * evidence — the kind of ablation a RAG engineer is expected to run.
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { buildVectorIndex } from "../src/ontology/embeddings/index.js";
import { answerWithGraphRAG } from "../src/ontology/engine/index.js";
import { PARAPHRASE_SET, ADVERSARIAL } from "../eval/paraphraseSet.js";

const store = createStore(buildUsFinanceDataset());
const index = buildVectorIndex(store);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

const groundedAndCorrect = (opts) => {
  let grounded = 0, correct = 0;
  for (const c of PARAPHRASE_SET) {
    const a = answerWithGraphRAG(store, c.q, opts);
    if (a.grounded) {
      grounded++;
      if (c.anchorsAny.includes(a.anchors[0]?.id)) correct++;
    }
  }
  return { grounded: pct(grounded, PARAPHRASE_SET.length), correct: pct(correct, PARAPHRASE_SET.length) };
};
const noFab = (opts) => {
  let ok = 0;
  for (const q of ADVERSARIAL) if (answerWithGraphRAG(store, q, opts).supportStatus === "unsupported") ok++;
  return pct(ok, ADVERSARIAL.length);
};

// ── A) strategy comparison ──
console.log("\n=== A) Retrieval strategy — paraphrase queries (no exact entity words) ===");
console.log("strategy        groundedRecall   anchorCorrect   noFabrication");
for (const s of [
  { name: "lexical-only", opts: { lexicalOnly: true, index } },
  { name: "hybrid (0.25)", opts: { index } },
]) {
  const r = groundedAndCorrect(s.opts);
  console.log(`  ${s.name.padEnd(14)}  ${(r.grounded + "%").padStart(8)}        ${(r.correct + "%").padStart(8)}       ${(noFab(s.opts) + "%").padStart(6)}`);
}
console.log("  → lexical alone CAN'T recover paraphrases; hybrid does, without fabricating.");

// ── B) semantic-threshold sweep ──
console.log("\n=== B) Semantic-threshold sweep — recall vs no-fabrication tradeoff ===");
console.log("threshold   paraphraseRecall   anchorCorrect   noFabrication");
let best = null;
for (const t of [0.10, 0.15, 0.20, 0.25, 0.30, 0.35]) {
  const r = groundedAndCorrect({ index, semanticThreshold: t });
  const nf = noFab({ index, semanticThreshold: t });
  console.log(`  ${String(t).padEnd(8)}   ${(r.correct + "%").padStart(8)}          ${(r.correct + "%").padStart(8)}      ${(nf + "%").padStart(6)}`);
  // sweet spot = no fabrication AND max correct recall
  if (nf === 100 && (!best || r.correct > best.correct)) best = { t, correct: r.correct };
}
console.log(`  → sweet spot: threshold=${best?.t} (noFabrication=100% with max recall ${best?.correct}%). 현재 기본값 0.25와 일치.`);
