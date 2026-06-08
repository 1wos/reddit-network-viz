/**
 * Symbolic Guard smoke test — the System-2 layer over the LLM's candidates.
 * Exercises the slide-deck contract: a candidate is checked against declarative
 * rules → { decision: valid|invalid|needs_review, firedRules, explanationPath }.
 *   node scripts/symbolic-guard-smoke.mjs
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { evaluateGuard, guardAllRiskSignals, answerWithGuard } from "../src/ontology/engine/index.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) failed++; };

const store = createStore(buildUsFinanceDataset());

// 1) Batch triage over every open RiskSignal
const verdicts = guardAllRiskSignals(store);
console.log(`\n— guarding ${verdicts.length} risk signal(s)`);
for (const v of verdicts) {
  console.log(`   ${v.subject}: ${v.decision.toUpperCase()}  fired=[${v.firedRules.join(", ")}]`);
  console.log(`      path: ${v.explanationPath.join(" → ")}`);
  if (v.unmet.length) console.log(`      unmet: ${v.unmet.map((u) => `${u.name}(${u.severity})`).join(", ")}`);
}
ok(verdicts.length > 0, "at least one risk signal to guard");
ok(verdicts.every((v) => ["valid", "invalid", "needs_review"].includes(v.decision)), "every verdict is a valid three-state decision");
ok(verdicts.some((v) => v.decision === "valid"), "at least one signal passes the guard (valid)");
ok(verdicts.every((v) => v.explanationPath[0] && v.explanationPath.length >= 1), "explanationPath starts at the subject");

// 2) A valid verdict must have fired its hard rules and traced a path past the subject
const valid = verdicts.find((v) => v.decision === "valid");
ok(valid.firedRules.includes("impacts_asset"), "valid verdict fired impacts_asset (hard)");
ok(valid.firedRules.includes("has_evidence"), "valid verdict fired has_evidence");
ok(valid.explanationPath.length >= 2, `valid explanationPath traverses a hop: ${valid.explanationPath.join(" → ")}`);

// 3) Hard violation → invalid: acknowledge a signal, it must no longer pass (open_status fails)
const target = valid.subject;
store.dispatch("acknowledgeSignal", { signalId: target });
const after = evaluateGuard(store, "escalateRisk", target);
ok(after.decision === "invalid", `acknowledged signal → invalid (was valid): ${after.decision}`);
ok(after.unmet.some((u) => u.name === "open_status"), "invalid reason names open_status (hard violation)");

// 4) Hallucinated subject → invalid (not grounded), never a silent pass
const ghost = evaluateGuard(store, "escalateRisk", "totally_made_up_signal");
ok(ghost.decision === "invalid", `ungrounded candidate → invalid: ${ghost.decision}`);
ok(ghost.unmet.some((u) => u.name === "grounded"), "ungrounded reason names grounded (no fabrication)");

// 5) Closed neurosymbolic loop: GraphRAG proposes → guard checks → only valid is actionable.
//    Use a fresh store (the earlier acknowledge mutated the shared one).
const loopStore = createStore(buildUsFinanceDataset());
const guarded = answerWithGuard(loopStore, "What market risks are emerging from Reddit discussions?");
console.log(`\n— closed loop: "${guarded.question}"`);
console.log(`   proposed ${guarded.guardrails.length} risk candidate(s); actionable=[${guarded.actionable.join(", ")}]`);
for (const v of guarded.guardrails) console.log(`      ${v.subject}: ${v.decision}`);
ok(guarded.guardrails.length > 0, "answerWithGuard surfaced & guarded RiskSignal candidates");
ok(guarded.guardrails.every((v) => ["valid", "invalid", "needs_review"].includes(v.decision)), "every guardrail is a three-state verdict");
ok(guarded.actionable.length < guarded.guardrails.length, "guard filtered out at least one proposed candidate (System 2 gated System 1)");
ok(guarded.actionable.every((id) => guarded.guardrails.find((v) => v.subject === id)?.decision === "valid"), "actionable = only the valid verdicts");

console.log(failed ? `\n❌ ${failed} failed` : "\n✅ ALL GREEN — Symbolic Guard + closed neurosymbolic loop (propose → guard → actionable)");
process.exit(failed ? 1 : 0);
