/**
 * Engine — Evidence Bundle + grounded answer
 *
 * Serializes a query plan into an inspectable evidence bundle and a grounded
 * answer with an explicit `supportStatus` (supported | partial | unsupported)
 * that NAMES the slots still missing from the graph — the discipline is:
 * "answer from the bundle while naming what is still missing", so the graph is
 * the answer substrate, not a reranking hint.
 */

import { momentum } from "../functions/index.js";

/* Source posts via the EVIDENCED_BY lineage edge, ranked by score. */
function collectEvidence(store, ids, limit = 5) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    for (const l of store.getLinks({ type: "EVIDENCED_BY", source: id })) {
      const p = store.get(l.target);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      const sub = store.getLinks({ type: "POSTED_IN", source: p.id })[0];
      out.push({ id: p.id, title: p.title, snippet: p.body, sentiment: p.sentiment, score: p.score, subreddit: sub?.target || null });
    }
  }
  return out.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
}

function synthesize(store, plan, missing) {
  const anchor = plan.anchors[0];
  if (!plan.grounded) {
    return `No entity in the ontology matched this question${anchor ? ` (closest active node: ${anchor.label})` : ""}. ` +
      `Nothing is asserted — the graph does not ground this query.`;
  }
  const parts = [];
  if (anchor) {
    const node = store.get(anchor.id);
    const mo = node ? momentum(node) : 0;
    parts.push(`${anchor.label} — ${plan.intent.label.toLowerCase()} (${mo >= 0 ? "+" : ""}${mo} / 7d momentum).`);
  } else {
    parts.push(`${plan.intent.label}.`);
  }
  for (const [name, list] of Object.entries(plan.slots)) {
    if (!list.length) continue;
    parts.push(`${plan.slotLabels[name]}: ${list.slice(0, 3).map((n) => n.label).join(", ")}.`);
  }
  if (plan.path?.length > 1) parts.push(`Path: ${plan.path.map((s) => s.label).join(" → ")}.`);
  if (missing.length) parts.push(`Not yet evidenced in the graph: ${missing.join(", ")}.`);
  return parts.join(" ");
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Build the grounded answer bundle from a plan. */
export function buildBundle(store, plan, context) {
  const slotNodeIds = Object.values(plan.slots).flatMap((l) => l.map((n) => n.id));
  const anchorIds = plan.anchors.map((a) => a.id);
  const evidence = collectEvidence(store, [...anchorIds, ...slotNodeIds]);

  // support assessment
  const req = plan.requiredSlots;
  const filledReq = req.filter((s) => (plan.slots[s.name] || []).length > 0);
  const missingSlots = req.filter((s) => (plan.slots[s.name] || []).length === 0).map((s) => s.label);
  const anyFilled = Object.values(plan.slots).some((v) => v.length > 0) || (plan.path && plan.path.length > 1);
  const supportStatus =
    !plan.grounded ? "unsupported"   // no real anchor → never claim support (no fabrication)
      : req.length > 0 && filledReq.length === req.length && evidence.length > 0 ? "supported"
        : anyFilled ? "partial" : "unsupported";

  // confidence = anchor confidence × slot-coverage
  const anchorConf = avg(anchorIds.map((id) => store.get(id)?.confidence ?? 0.7));
  const coverage = req.length ? filledReq.length / req.length : 1;
  const confidence = Math.round(anchorConf * (0.5 + 0.5 * coverage) * 100) / 100;

  const related = [];
  const seen = new Set();
  for (const list of Object.values(plan.slots)) for (const n of list) {
    if (!seen.has(n.id)) { seen.add(n.id); related.push({ id: n.id, label: n.label, type: n.type, via: n.via }); }
  }

  const followUps = related.slice(0, 3).map((n) => `How does ${n.label} relate to ${plan.anchors[0]?.label || "this"}?`);

  return {
    intent: plan.intent,
    anchors: plan.anchors,
    grounded: plan.grounded,
    summary: synthesize(store, plan, missingSlots),
    supportStatus,
    missingSlots,
    confidence,
    slots: plan.slots,
    relatedNodes: related.slice(0, 8),
    evidence,
    path: plan.path,
    subgraph: plan.subgraph,
    followUps,
    contextHash: context?.hash,
  };
}
