/**
 * Symbolic AI — the Guard (System 2 over the LLM's System 1)
 *
 * The deck's centerpiece: an LLM (or any upstream) *proposes* a candidate
 * (e.g. "escalate recession_risk"); the guard checks it against declarative
 * rules and returns a three-state verdict with the rules it fired and the graph
 * path that justifies it — the slide-deck contract:
 *
 *   { decision: "valid" | "invalid" | "needs_review",
 *     firedRules: ["grounded", "magnitude_above", "impacts_asset", ...],
 *     explanationPath: ["Recession risk", "S&P 500", "post:r/finance:..."] }
 *
 * Rules are DATA, not code (same discipline as intents.js): a rule set is an
 * ordered list of atoms, each naming a predicate, its args, and a severity:
 *   - "hard"     → a failure is a rule *violation*      → decision = invalid
 *   - "evidence" → a failure is missing *grounding*     → decision = needs_review
 * All atoms satisfied → valid. (Mirrors the deck's valid / invalid / needs_review.)
 */

import { PREDICATES } from "./predicates.js";

/* Declarative rule sets. To add a guard you add data here, not control flow.
   escalateRisk ≙ the deck's recommend(Employee, Project): a candidate is only
   surfaced when every hard rule holds and it is backed by evidence. */
export const RULE_SETS = {
  escalateRisk: {
    label: "Escalate risk signal",
    subjectType: "RiskSignal",
    rules: [
      { name: "grounded",        pred: "grounded",                                   severity: "hard" },
      { name: "typed_risk",      pred: "ofType",     args: ["RiskSignal"],           severity: "hard" },
      { name: "open_status",     pred: "open",                                       severity: "hard" },
      { name: "magnitude_above", pred: "propAtLeast", args: ["magnitude", 0.5],      severity: "hard" },
      { name: "impacts_asset",   pred: "linksTo",     args: ["IMPACTS", "AssetOrTicker"], severity: "hard" },
      { name: "has_evidence",    pred: "hasEvidence",                                severity: "evidence" },
    ],
  },
};

/**
 * Evaluate a candidate against a rule set.
 * @returns { decision, firedRules, unmet, explanationPath, ruleSet, subject }
 */
export function evaluateGuard(store, ruleSetName, subjectId) {
  const set = RULE_SETS[ruleSetName];
  if (!set) throw new Error(`unknown rule set: ${ruleSetName}`);

  const fired = [];      // atoms that held (the "fired_rules")
  const unmet = [];      // atoms that failed, with severity + detail
  const hops = [];       // graph hops collected from satisfied predicates

  for (const r of set.rules) {
    const fn = PREDICATES[r.pred];
    if (!fn) throw new Error(`unknown predicate: ${r.pred}`);
    const res = fn(store, subjectId, r.args || []);
    if (res.ok) {
      fired.push(r.name);
      if (res.via?.node) hops.push(res.via.node);
    } else {
      unmet.push({ name: r.name, severity: r.severity, detail: res.detail });
    }
  }

  // Three-state decision: any hard violation → invalid; else any missing
  // evidence → needs_review; else valid.
  const hardFail = unmet.some((u) => u.severity === "hard");
  const evidenceFail = unmet.some((u) => u.severity === "evidence");
  const decision = hardFail ? "invalid" : evidenceFail ? "needs_review" : "valid";

  // explanation_path: subject → satisfying graph hops (asset impacted, source post).
  const subject = store.get(subjectId);
  const explanationPath = [subject?.label || subjectId, ...hops.map((n) => n.label || n.id || n.title)];

  return { decision, firedRules: fired, unmet, explanationPath, ruleSet: ruleSetName, subject: subjectId };
}

/** Convenience: evaluate every open RiskSignal — the batch a reviewer would triage. */
export function guardAllRiskSignals(store) {
  return store.all("RiskSignal").map((s) => evaluateGuard(store, "escalateRisk", s.id));
}
