/**
 * Symbolic AI — Predicate library (the "facts" rules are built from)
 *
 * Each predicate is a pure, deterministic check over the ontology store and a
 * subject node — the Datalog/Prolog body atoms of the slide deck's
 * `validate_recommendation(...)`. A predicate returns:
 *
 *   { ok: boolean, detail?: string, via?: { node, type } }
 *
 * `via` is the graph hop a satisfied predicate traversed, so the guard can stitch
 * the satisfying hops into an explanation_path (subject → … → evidence). Pure
 * functions, no LLM — this is System 2: the symbolic reasoner that checks the
 * candidate the neural layer (System 1 / LLM) proposed.
 */

/** Subject is a real node in the ontology (not an LLM-hallucinated id). */
export function grounded(store, id) {
  return { ok: store.has(id), detail: store.has(id) ? null : `no node ${id} in ontology` };
}

/** Subject is of the expected ontology type. */
export function ofType(store, id, [type]) {
  const o = store.get(id);
  return { ok: !!o && o.__type === type, detail: o ? `type=${o.__type}` : "missing node" };
}

/** Signal is still actionable (not acknowledged/closed) — no double-escalation. */
export function open(store, id) {
  const o = store.get(id);
  return { ok: o?.status === "open", detail: `status=${o?.status ?? "?"}` };
}

/** Numeric prop at or above a threshold (e.g. magnitude ≥ 0.5). */
export function propAtLeast(store, id, [prop, threshold]) {
  const v = store.get(id)?.[prop];
  return { ok: typeof v === "number" && v >= threshold, detail: `${prop}=${v ?? "?"} (≥ ${threshold})` };
}

/** Subject has an outgoing link of `type` to a node of one of `toTypes`. */
export function linksTo(store, id, [type, toTypes]) {
  const allow = [].concat(toTypes);
  for (const l of store.getLinks({ type, source: id })) {
    const t = store.get(l.target);
    if (t && allow.includes(t.__type)) return { ok: true, detail: `${type}→${t.label}`, via: { node: t, type } };
  }
  return { ok: false, detail: `no ${type}→{${allow.join("|")}}` };
}

/** Subject is backed by at least one source post via the EVIDENCED_BY lineage edge. */
export function hasEvidence(store, id) {
  const l = store.getLinks({ type: "EVIDENCED_BY", source: id })[0];
  const post = l && store.get(l.target);
  return post
    ? { ok: true, detail: `evidence=${post.id}`, via: { node: post, type: "EVIDENCED_BY" } }
    : { ok: false, detail: "no EVIDENCED_BY post" };
}

export const PREDICATES = { grounded, ofType, open, propAtLeast, linksTo, hasEvidence };
