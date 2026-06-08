/**
 * Engine — Query Planner
 *
 * Turns a question into a graph plan: match intent → resolve anchors → fill the
 * intent's declarative slots by traversing typed/directed/polarity-filtered
 * links → (optionally) compute a path between two anchors → return the selected
 * subgraph. Generic over the intent slot schema in intents.js.
 */

import { matchIntent } from "./intents.js";
import { semanticSearch, rerankByVector } from "../embeddings/index.js";

const SEMANTIC_THRESHOLD = 0.25; // below this, a vector "match" is noise → stay ungrounded.
// (Tuned on the eval golden set: off-domain queries peak ~0.20 via n-gram collisions
//  in the deps-free HashingEmbedder; real semantic embeddings separate far more cleanly.)

/* Resolve the focus node(s) the question is about.
   Returns { anchors, grounded, via } — grounded=false means nothing in the
   ontology actually matched (so the answer must NOT claim support). Resolution
   is HYBRID: exact/lexical match first (ordered subject-first so "how does X
   affect Y" gets X→Y), then a semantic vector fallback over contextual
   embeddings when lexical misses — but only above a similarity threshold. */
function resolveAnchors(store, question, intent, opts = {}) {
  if (intent.anchor.mode === "allOfType") {
    return { anchors: store.all(intent.anchor.ofType).sort((a, b) => (b.frequency || 0) - (a.frequency || 0)), grounded: true, via: "type" };
  }
  const q = (question || "").toLowerCase();
  const matches = [];
  for (const o of store.all()) {
    if (!o.label) continue; // skip Author/Subreddit noise
    let idx = q.indexOf(o.label.toLowerCase());
    if (idx < 0) {
      // label + ticker only (NOT id), and keep hyphenated terms intact ("rate-cut"
      // must not split into "rate") — both were sources of false anchor hits.
      const words = [o.label, o.ticker].filter(Boolean).join(" ").toLowerCase().split(/[\s_]+/);
      for (const w of words) {
        if (w.length <= 3) continue; // skip short, ambiguous tokens
        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`); // word-boundary, not substring
        const wi = q.search(re);
        if (wi >= 0) idx = idx < 0 ? wi : Math.min(idx, wi);
      }
    }
    if (idx >= 0) matches.push({ o, idx });
  }
  const lexicalHit = matches.length > 0;

  // Vocabulary/alias resolution: "the Fed" → federal_reserve, "team green" → nvidia.
  if (opts.vocab) {
    for (const h of opts.vocab.resolve(question)) {
      const o = store.get(h.id);
      if (o && o.label && !matches.some((m) => m.o.id === o.id)) matches.push({ o, idx: h.idx });
    }
  }

  matches.sort((a, b) => a.idx - b.idx || (b.o.frequency || 0) - (a.o.frequency || 0));
  if (matches.length) return { anchors: matches.map((m) => m.o), grounded: true, via: lexicalHit ? "lexical" : "alias" };

  // Semantic fallback: vector search over contextual embeddings (hybrid retrieval).
  if (opts.index && opts.lexicalOnly !== true) {
    const threshold = opts.semanticThreshold ?? SEMANTIC_THRESHOLD;
    const hits = semanticSearch(opts.index, question, 4, opts.embedder).filter((h) => h.score >= threshold);
    if (hits.length) {
      const anchors = hits.map((h) => store.get(h.id)).filter(Boolean);
      if (anchors.length) return { anchors, grounded: true, via: "semantic" };
    }
  }

  const fallback = store.all().filter((o) => o.label).sort((a, b) => (b.frequency || 0) - (a.frequency || 0)).slice(0, 1);
  return { anchors: fallback, grounded: false, via: "none" };
}

/* Collect slot nodes by traversing typed links from the anchors. */
function fillSlot(store, anchors, spec) {
  const out = new Map();
  for (const a of anchors) {
    for (const nb of store.neighbors(a.id)) {
      if (!spec.via.includes(nb.type)) continue;
      if (spec.dir && spec.dir !== "any" && nb.dir !== spec.dir) continue;
      if (spec.nodeTypes && !spec.nodeTypes.includes(nb.node.__type)) continue;
      if (spec.linkPolarity && nb.props?.polarity !== spec.linkPolarity) continue;
      if (nb.node.id === a.id) continue;
      out.set(nb.node.id, { id: nb.node.id, label: nb.node.label, type: nb.node.__type, via: nb.type, dir: nb.dir, props: nb.props });
    }
  }
  return [...out.values()].sort((x, y) => (y.props?.weight || 0) - (x.props?.weight || 0));
}

/* BFS shortest path (≤ maxDepth hops) between two anchors. */
function bfsPath(store, fromNode, toId, maxDepth = 3) {
  const seen = new Set([fromNode.id]);
  let frontier = [[{ id: fromNode.id, label: fromNode.label, type: fromNode.__type }]];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = [];
    for (const path of frontier) {
      const last = path[path.length - 1].id;
      for (const nb of store.neighbors(last)) {
        if (seen.has(nb.node.id)) continue;
        const step = { id: nb.node.id, label: nb.node.label, type: nb.node.__type, via: nb.type, dir: nb.dir };
        const extended = [...path, step];
        if (nb.node.id === toId) return extended;
        seen.add(nb.node.id);
        next.push(extended);
      }
    }
    frontier = next;
  }
  return null;
}

/** Produce a graph plan for a question. */
export function planQuery(store, question, opts = {}) {
  const intent = matchIntent(question);
  const { anchors, grounded, via } = resolveAnchors(store, question, intent, opts);

  const slots = {};
  for (const spec of intent.slots) slots[spec.name] = fillSlot(store, anchors, spec);

  // KG-RAG stage 3 — Vector Reranking: reorder graph-expanded slot candidates by
  // query relevance (vector sim blended with graph weight). Only when a vector
  // index is supplied; pure reorder, so grounding/recall are preserved.
  const reranked = !!(opts.index && opts.rerank !== false);
  if (reranked) {
    for (const name of Object.keys(slots)) slots[name] = rerankByVector(opts.index, question, slots[name], opts);
  }

  let path = null;
  if (intent.pathfind && anchors.length >= 2) path = bfsPath(store, anchors[0], anchors[1].id);

  // selected subgraph = anchors ∪ slot nodes
  const nodeIds = new Set(anchors.map((a) => a.id));
  for (const list of Object.values(slots)) for (const n of list) nodeIds.add(n.id);
  if (path) for (const s of path) nodeIds.add(s.id);
  const links = store.getLinks().filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));

  return {
    intent: { id: intent.id, label: intent.label },
    grounded,
    retrieval: via,
    reranked,
    anchors: anchors.map((a) => ({ id: a.id, label: a.label, type: a.__type, frequency: a.frequency })),
    slots,
    path,
    subgraph: { nodeIds: [...nodeIds], links },
    requiredSlots: intent.slots.filter((s) => s.required).map((s) => ({ name: s.name, label: s.label })),
    slotLabels: Object.fromEntries(intent.slots.map((s) => [s.name, s.label])),
  };
}
