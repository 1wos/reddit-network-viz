/**
 * Eval harness — runs the golden set through the engine and computes metrics:
 *   - intent accuracy
 *   - anchor recall (did it find the expected focus node[s])
 *   - related recall@k (did expected neighbors surface)
 *   - support accuracy (predicted vs expected supportStatus)
 *   - no-fabrication rate (adversarial questions → unsupported)
 *   - citation faithfulness (every cited post actually mentions an answer node)
 *
 * Pure functions of (store, index, goldenSet) → scorecard.
 */

import { answerWithGraphRAG } from "../src/ontology/engine/index.js";

const pct = (x) => Math.round(x * 1000) / 10;
const overlap = (a, b) => a.filter((x) => b.includes(x));

/** Are this answer's cited posts actually about the answer's nodes? (faithfulness proxy) */
function citationFaithfulness(store, answer) {
  const answerIds = new Set([...answer.anchors.map((a) => a.id), ...answer.relatedNodes.map((n) => n.id)]);
  if (!answer.evidence.length) return null;
  let valid = 0;
  for (const e of answer.evidence) {
    const mentioned = store.getLinks({ type: "MENTIONS", source: e.id }).map((l) => l.target);
    if (mentioned.some((m) => answerIds.has(m))) valid++;
  }
  return valid / answer.evidence.length;
}

export function runEval(store, index, goldenSet) {
  const rows = [];
  const m = { intent: [], anchor: [], related: [], support: [], noFab: [], faith: [] };

  for (const g of goldenSet) {
    const a = answerWithGraphRAG(store, g.q, { index });
    const predIntent = a.intent.id;
    const predAnchors = a.anchors.map((x) => x.id);
    const relatedIds = a.relatedNodes.map((n) => n.id);

    const intentOk = g.intent == null ? true : predIntent === g.intent;
    const anchorRecall = g.anchors.length ? overlap(g.anchors, predAnchors).length / g.anchors.length : null;
    const relatedHit = g.relatedAny && g.relatedAny.length ? overlap(g.relatedAny, relatedIds).length > 0 : null;
    const supportOk = a.supportStatus === g.support;
    const faith = citationFaithfulness(store, a);

    if (g.intent != null) m.intent.push(intentOk ? 1 : 0);
    if (anchorRecall != null) m.anchor.push(anchorRecall);
    if (relatedHit != null) m.related.push(relatedHit ? 1 : 0);
    m.support.push(supportOk ? 1 : 0);
    if (g.adversarial) m.noFab.push(a.supportStatus === "unsupported" ? 1 : 0);
    if (faith != null && !g.adversarial) m.faith.push(faith);

    let pathOk = null;
    if (g.pathEnds) pathOk = a.path && a.path[0]?.id === g.pathEnds[0] && a.path.at(-1)?.id === g.pathEnds[1];

    rows.push({ q: g.q.slice(0, 46), intent: `${predIntent}${intentOk ? "" : `≠${g.intent}`}`,
      support: `${a.supportStatus}${supportOk ? "" : `≠${g.support}`}`, retrieval: a.retrieval,
      anchorR: anchorRecall == null ? "-" : pct(anchorRecall) + "%", related: relatedHit == null ? "-" : (relatedHit ? "✓" : "✗"),
      path: pathOk == null ? "-" : (pathOk ? "✓" : "✗"), faith: faith == null ? "-" : pct(faith) + "%" });
  }

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1);
  const scorecard = {
    intentAccuracy: pct(mean(m.intent)),
    anchorRecall: pct(mean(m.anchor)),
    relatedRecallAtK: pct(mean(m.related)),
    supportAccuracy: pct(mean(m.support)),
    noFabricationRate: pct(mean(m.noFab)),
    citationFaithfulness: pct(mean(m.faith)),
    n: goldenSet.length,
  };
  return { rows, scorecard };
}
