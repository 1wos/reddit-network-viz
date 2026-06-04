/**
 * Ontology Control Plane (lite) — from seocho's OntologySignal → OntologyProfile.
 *
 * Every run emits typed *signals* (design issues from lint + query-side
 * discoveries like unresolved anchors, missing slots, low confidence, alias
 * usage). Signals are compiled into a reviewable, versioned *profile* keyed by
 * the ontology-context hash, and two profiles can be diffed (baseline vs
 * candidate) — the operational loop that lets you *measure and promote* ontology
 * changes instead of eyeballing them.
 */
import { lintOntology } from "./lint.js";
import { buildOntologyContext } from "./engine/ontologyContext.js";
import { answerWithGraphRAG } from "./engine/index.js";

/** Emit signals from one ontology + a probe set of questions. */
export function collectSignals(store, questions = [], opts = {}) {
  const signals = [];
  const add = (type, severity, detail) => signals.push({ type, severity, ...detail });

  // design-side signals (lint)
  const lint = lintOntology(store);
  for (const e of lint.errors) add(`design.${e.code}`, "error", { detail: e });
  for (const w of lint.warnings) add(`design.${w.code}`, "warn", { detail: w });

  // query-side signals
  for (const q of questions) {
    const a = answerWithGraphRAG(store, q, opts);
    if (!a.grounded) add("query.unresolved_anchor", "warn", { q });
    else if (a.retrieval === "alias") add("query.alias_used", "info", { q });
    if (a.supportStatus === "unsupported") add("query.unsupported", "warn", { q });
    if (a.missingSlots?.length) add("query.missing_slot", "info", { q, detail: a.missingSlots });
    if (a.grounded && a.confidence < 0.6) add("query.low_confidence", "info", { q, confidence: a.confidence });
  }
  return signals;
}

/** Compile a reviewable, versioned profile from a run. */
export function buildProfile(store, { questions = [], opts = {}, label = "default" } = {}) {
  const ctx = buildOntologyContext(store);
  const signals = collectSignals(store, questions, opts);
  const summary = {};
  for (const s of signals) summary[s.type] = (summary[s.type] || 0) + 1;
  const severity = { error: 0, warn: 0, info: 0 };
  for (const s of signals) severity[s.severity]++;
  return {
    profileId: `${label}@${ctx.hash}`,
    contextHash: ctx.hash,
    status: severity.error ? "blocked" : "candidate",
    objectCounts: ctx.objectCounts,
    signalCount: signals.length,
    severity,
    signalSummary: summary,
    signals,
  };
}

/** Diff two profiles (baseline vs candidate) — the promote/rollback decision input. */
export function compareProfiles(baseline, candidate) {
  const keys = new Set([...Object.keys(baseline.signalSummary), ...Object.keys(candidate.signalSummary)]);
  const diff = {};
  for (const k of keys) {
    const b = baseline.signalSummary[k] || 0, c = candidate.signalSummary[k] || 0;
    if (b !== c) diff[k] = { baseline: b, candidate: c, delta: c - b };
  }
  return {
    contextChanged: baseline.contextHash !== candidate.contextHash,
    severityDelta: { error: candidate.severity.error - baseline.severity.error, warn: candidate.severity.warn - baseline.severity.warn },
    diff,
    recommendation:
      candidate.severity.error > baseline.severity.error || candidate.severity.warn > baseline.severity.warn ? "rollback"
        : candidate.severity.warn < baseline.severity.warn ? "promote" : "review",
  };
}
