/**
 * Embeddings — contextual text builder
 *
 * "Contextual embedding": instead of embedding a bare label, we embed each
 * entity together with its ONTOLOGY NEIGHBORHOOD (typed relations to other
 * nodes) and its EVIDENCE (source post titles). This is the knowledge-graph
 * analogue of Anthropic's contextual retrieval — the vector captures how the
 * node sits in the graph, not just its name, which sharply improves retrieval
 * for paraphrased / indirect queries.
 */

import { edgeTypeMeta } from "../schema.js";

export function contextualText(store, node) {
  const parts = [`${node.label} is a ${node.__type}.`];
  if (node.shortSummary) parts.push(node.shortSummary);
  if (node.ticker) parts.push(`Ticker ${node.ticker}.`);
  if (node.category) parts.push(`Category ${node.category}.`);
  if (node.riskType) parts.push(`Risk type ${node.riskType}.`);

  const rels = store.neighbors(node.id).slice(0, 8)
    .map((n) => `${edgeTypeMeta(n.type).label} ${n.node.label}`);
  if (rels.length) parts.push(`Related: ${rels.join("; ")}.`);

  const evidence = store.getLinks({ type: "EVIDENCED_BY", source: node.id })
    .map((l) => store.get(l.target)).filter(Boolean).slice(0, 3)
    .map((p) => p.title);
  if (evidence.length) parts.push(`Discussed in: ${evidence.join(" ")}`);

  return parts.join(" ");
}
