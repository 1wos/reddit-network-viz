/**
 * Ontology lint (gap filled from seocho's ontology_lint / ISO-704 rigor)
 *
 * Validates the ontology *design quality*, not just per-instance schema:
 *  - dangling links (endpoint missing)
 *  - endpoint-type violations (link used between disallowed types)
 *  - orphan entities (no relationships)
 *  - signals with no evidence (EVIDENCED_BY)
 *  - type coverage (declared types with zero instances)
 *  - schema validation (delegates to store.validate)
 *
 * Returns { errors, warnings, info, stats, ok }.
 */
import { OBJECT_TYPES } from "./types/objectTypes.js";
import { LINK_TYPES } from "./types/linkTypes.js";

const SOURCE_TYPES = new Set(["Subreddit", "Author", "RedditPost"]); // not expected to be densely linked

export function lintOntology(store) {
  const errors = [], warnings = [], info = [];

  // 1) schema validation
  const v = store.validate();
  for (const e of v.errors) errors.push({ code: "schema", ...e });

  // 2) link integrity + endpoint-type conformance
  const linkedIds = new Set();
  for (const l of store.getLinks()) {
    const s = store.get(l.source), t = store.get(l.target);
    if (!s || !t) { errors.push({ code: "dangling_link", link: `${l.source}-[${l.type}]->${l.target}` }); continue; }
    linkedIds.add(l.source); linkedIds.add(l.target);
    const def = LINK_TYPES[l.type];
    if (def) {
      const from = [].concat(def.from), to = [].concat(def.to);
      if (!from.includes(s.__type)) warnings.push({ code: "endpoint_type", link: l.type, detail: `source ${s.__type} not in from(${from.join("|")})` });
      if (!to.includes(t.__type)) warnings.push({ code: "endpoint_type", link: l.type, detail: `target ${t.__type} not in to(${to.join("|")})` });
    }
  }

  // 3) orphan entities (domain nodes with no relationships)
  for (const o of store.all()) {
    if (SOURCE_TYPES.has(o.__type)) continue;
    if (!linkedIds.has(o[OBJECT_TYPES[o.__type]?.pk] ?? o.id)) warnings.push({ code: "orphan", node: o.id || o.label });
  }

  // 4) signals without evidence
  for (const sig of store.all().filter((o) => o.__type === "RiskSignal" || o.__type === "SentimentSignal")) {
    if (store.getLinks({ type: "EVIDENCED_BY", source: sig.id }).length === 0)
      warnings.push({ code: "signal_no_evidence", node: sig.id });
  }

  // 5) type coverage
  const counts = {};
  for (const o of store.all()) counts[o.__type] = (counts[o.__type] || 0) + 1;
  for (const t of Object.keys(OBJECT_TYPES)) {
    if (OBJECT_TYPES[t].abstract) continue;
    if (!counts[t]) info.push({ code: "unused_type", type: t });
  }

  return {
    ok: errors.length === 0,
    errors, warnings, info,
    stats: { nodes: store.count(), links: store.getLinks().length, byType: counts },
  };
}
