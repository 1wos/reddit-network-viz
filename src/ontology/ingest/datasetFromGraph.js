/**
 * Ingest — generic graph → store dataset adapter
 *
 * Converts the app's in-memory graph shape ({ nodes, edges, posts }) — for the
 * finance ontology OR any enriched legacy preset — into the store dataset shape
 * ({ objects, links }) the GraphRAG engine consumes, materializing the lineage
 * links (POSTED_IN / MENTIONS / EVIDENCED_BY) implied by the posts.
 *
 * Lenient on purpose (no schema-required-field enforcement) so every preset can
 * drive the engine; the strict, validated dataset lives in usFinanceDataset.js.
 */

const idOf = (x) => (typeof x === "object" && x ? x.id : x);

export function datasetFromGraph(graph) {
  if (!graph) return { objects: [], links: [] };
  const TS = 0;
  const objects = (graph.nodes || []).map((n) => ({
    __type: n.type || "Topic", __backingDataset: "reddit", __sourceRefs: [], __ingestedAt: TS, ...n,
  }));
  const links = [];

  for (const e of graph.edges || []) {
    const props = { weight: e.weight, confidence: e.confidence };
    if (e.type === "IMPACTS") { props.strength = e.weight; props.polarity = e.polarity || "positive"; }
    if (e.type === "CO_OCCURS_WITH" && e.weight != null) props.pmi = Math.round(e.weight * 3 * 100) / 100;
    links.push({ type: e.type || "CO_OCCURS_WITH", source: idOf(e.source), target: idOf(e.target), props });
  }

  const subs = new Set();
  for (const n of objects) for (const s of n.sourceSubreddits || []) subs.add(s);
  for (const p of graph.posts || []) subs.add(p.subreddit);
  for (const name of subs) objects.push({ __type: "Subreddit", __backingDataset: "reddit", __sourceRefs: [], __ingestedAt: TS, name });

  for (const p of graph.posts || []) {
    objects.push({
      __type: "RedditPost", __backingDataset: "reddit", __sourceRefs: [p.id], __ingestedAt: TS,
      id: p.id, title: p.title, body: p.snippet, score: p.score, sentiment: p.sentiment,
    });
    links.push({ type: "POSTED_IN", source: p.id, target: p.subreddit, props: {} });
    for (const id of p.mentions || []) {
      links.push({ type: "MENTIONS", source: p.id, target: id, props: { weight: 0.6, sentiment: p.sentiment } });
      links.push({ type: "EVIDENCED_BY", source: id, target: p.id, props: {} });
    }
  }

  return { objects, links };
}
