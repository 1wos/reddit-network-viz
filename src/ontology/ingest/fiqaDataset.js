/**
 * Ingest — FiQA → ontology dataset adapter
 *
 * Converts the open FiQA aspect-based financial sentiment dataset
 * (TheFinAI/fiqa-sentiment-classification, MIT) into the store's
 * { objects, links } shape — real data instead of the hand-authored mock.
 *
 * Each FiQA row { sentence, target, aspect, score, type } becomes:
 *   - a RedditPost (the sentence) carrying its sentiment score,
 *   - an Organization (the `target` entity) with aggregated frequency/sentiment,
 *   - a Topic (the `aspect` root, e.g. "Stock", "Corporate"),
 *   wired with MENTIONS(sentiment) + EVIDENCED_BY lineage + POSTED_IN.
 *
 * Pure transform (no I/O); a script loads data/fiqa-sentiment.json and passes
 * the rows in, so the browser bundle never pulls the dataset.
 */

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round2 = (x) => Math.round(x * 100) / 100;

export function buildFiqaDataset(rows, opts = {}) {
  const TS = 0;
  const data = opts.limit ? rows.slice(0, opts.limit) : rows;
  const objects = [];
  const links = [];
  const ents = new Map();   // entity id → { id, label, scores[] }
  const topics = new Map(); // topic id → { id, label, count }

  // Single synthetic source community so posts have lineage (POSTED_IN).
  objects.push({ __type: "Subreddit", __backingDataset: "fiqa", __sourceRefs: [], __ingestedAt: TS, name: "fiqa" });

  for (const r of data) {
    // FiQA reuses `_id` across splits, so namespace the post id to keep it unique.
    const pid = `fiqa-${r.split || "x"}-${r._id}`;
    const score = typeof r.score === "number" ? r.score : 0;

    objects.push({
      __type: "RedditPost", __backingDataset: "fiqa", __sourceRefs: [String(r._id)], __ingestedAt: TS,
      id: pid, title: String(r.sentence).slice(0, 140), body: String(r.sentence),
      sentiment: round2(clamp(score, -1, 1)), score: Math.round(Math.abs(score) * 100),
    });
    links.push({ type: "POSTED_IN", source: pid, target: "fiqa", props: {} });

    // Skip degenerate single-char targets — their labels substring-match common
    // words (e.g. "W" inside "why"), which would poison anchor resolution.
    const target = r.target ? String(r.target).trim() : "";
    if (target.length >= 2) {
      const eid = slug(target);
      if (eid) {
        if (!ents.has(eid)) ents.set(eid, { id: eid, label: target, scores: [] });
        ents.get(eid).scores.push(score);
        links.push({ type: "MENTIONS", source: pid, target: eid, props: { sentiment: round2(clamp(score, -1, 1)), weight: 0.6 } });
        links.push({ type: "EVIDENCED_BY", source: eid, target: pid, props: {} });
      }
    }

    const aspectRoot = String(r.aspect || "").split("/")[0];
    if (aspectRoot) {
      const tid = `topic_${slug(aspectRoot)}`;
      if (!topics.has(tid)) topics.set(tid, { id: tid, label: aspectRoot, count: 0 });
      topics.get(tid).count++;
      links.push({ type: "MENTIONS", source: pid, target: tid, props: { weight: 0.4 } });
    }
  }

  // Materialize entities with aggregated frequency + mean sentiment.
  for (const e of ents.values()) {
    const avg = e.scores.reduce((a, b) => a + b, 0) / e.scores.length;
    objects.push({
      __type: "Organization", __backingDataset: "fiqa", __sourceRefs: [], __ingestedAt: TS,
      id: e.id, label: e.label, frequency: e.scores.length, evidenceCount: e.scores.length,
      sentiment: round2(clamp(avg, -1, 1)), confidence: 0.7,
    });
  }
  for (const t of topics.values()) {
    objects.push({
      __type: "Topic", __backingDataset: "fiqa", __sourceRefs: [], __ingestedAt: TS,
      id: t.id, label: t.label, frequency: t.count, confidence: 0.7,
    });
  }

  return { objects, links };
}
