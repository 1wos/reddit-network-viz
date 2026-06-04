/**
 * Ingest — US finance dataset (mock connector)
 *
 * Transforms the hand-authored finance ontology (mockOntologyData) into typed
 * INSTANCES that validate against the ObjectType registry, and materializes the
 * source objects (RedditPost / Author / Subreddit) + lineage links
 * (POSTED_IN / AUTHORED_BY / MENTIONS / EVIDENCED_BY) that the raw graph implied.
 *
 * This is the "backing dataset" for Phase 1 — later swappable for SEC EDGAR /
 * price API / live Reddit connectors that emit the same instance shape.
 */

import { getFinanceOntology } from "../mockOntologyData.js";

const TS = 1717459200000; // fixed 2024-06-04 — deterministic ingestion stamp
const round2 = (x) => Math.round(x * 100) / 100;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] != null).map((k) => [k, o[k]]));

/* Per-id metadata not carried on the raw node (required-field fillers). */
const META = {
  // Organizations → sector
  nvidia: { sector: "tech" }, openai: { sector: "tech" }, microsoft: { sector: "tech" },
  amd: { sector: "tech" }, tsmc: { sector: "tech" }, meta: { sector: "tech" },
  federal_reserve: { sector: "finance" }, microstrategy: { sector: "finance" }, coinbase: { sector: "finance" },
  // Assets → assetClass (required)
  bitcoin: { assetClass: "crypto" }, ethereum: { assetClass: "crypto" },
  gold: { assetClass: "commodity" }, crude_oil: { assetClass: "commodity" },
  // Persons → role
  jerome_powell: { role: "Fed Chair" }, sam_altman: { role: "CEO, OpenAI" }, jensen_huang: { role: "CEO, NVIDIA" },
  janet_yellen: { role: "Treasury Secretary" }, michael_saylor: { role: "Chairman, MicroStrategy" },
  // Events → eventType (required)
  fomc_decision: { eventType: "fomc" }, nvda_earnings: { eventType: "earnings" },
  cpi_release: { eventType: "macro" }, etf_approval: { eventType: "product" },
  // Risk signals → riskType (required) + horizon
  recession_risk: { riskType: "macro", horizon: "mid" }, ai_bubble_risk: { riskType: "concentration", horizon: "mid" },
  liquidity_risk: { riskType: "liquidity", horizon: "near" }, credit_risk: { riskType: "credit", horizon: "mid" },
  geopolitical_risk: { riskType: "market", horizon: "long" },
};

const ENTITY_BASE = ["id", "label", "frequency", "sentiment", "confidence", "trend", "shortSummary", "sourceSubreddits"];

function buildInstance(n) {
  const base = pick(n, ENTITY_BASE);
  const m = META[n.id] || {};
  switch (n.type) {
    case "Organization": return { ...base, ...pick({ ticker: n.ticker, sector: m.sector }, ["ticker", "sector"]) };
    case "AssetOrTicker": return { ...base, ticker: n.ticker || m.ticker, assetClass: m.assetClass };
    case "Product": return base;
    case "Person": return { ...base, role: m.role };
    case "Topic": return { ...base, category: n.category || m.category };
    case "Event":
      return { id: n.id, label: n.label, eventType: m.eventType, status: "upcoming",
        confidence: n.confidence, sourceSubreddits: n.sourceSubreddits, scheduledAt: TS };
    case "SentimentSignal":
      return { id: n.id, label: n.label, magnitude: clamp01(Math.abs(n.sentiment)), confidence: n.confidence,
        status: "open", evidenceCount: n.evidenceCount, createdAt: TS, sourceSubreddits: n.sourceSubreddits,
        direction: n.sentiment >= 0 ? "positive" : "negative", delta: round2(n.sentiment) };
    case "RiskSignal":
      return { id: n.id, label: n.label, magnitude: clamp01(Math.abs(n.sentiment)), confidence: n.confidence,
        status: "open", evidenceCount: n.evidenceCount, createdAt: TS, sourceSubreddits: n.sourceSubreddits,
        riskType: m.riskType || "market", horizon: m.horizon || "mid" };
    default: return base;
  }
}

const subCategory = (name) =>
  ["finance", "technology", "worldnews", "science", "gaming"].includes(name) ? name : "other";

/** Build the typed instance dataset: { objects, links }. */
export function buildUsFinanceDataset() {
  const { nodes, edges, posts } = getFinanceOntology();
  const objects = [];
  const links = [];

  // node id → posts that mention it (for __sourceRefs)
  const refsOf = {};
  for (const p of posts) for (const id of p.mentions || []) (refsOf[id] ||= []).push(p.id);

  // 1) Entity / Topic / Event / Signal instances
  for (const n of nodes) {
    objects.push({
      __type: n.type, __backingDataset: "reddit-mock", __sourceRefs: refsOf[n.id] || [], __ingestedAt: TS,
      ...buildInstance(n),
    });
  }

  // 2) Typed edges between those nodes (carry link properties)
  for (const e of edges) {
    const props = { weight: e.weight, confidence: e.confidence };
    if (e.type === "IMPACTS") { props.strength = e.weight; props.polarity = e.polarity || "positive"; }
    if (e.type === "CO_OCCURS_WITH") props.pmi = Math.round(e.weight * 3 * 100) / 100;
    links.push({ type: e.type, source: e.source, target: e.target, props });
  }

  // 3) Source objects (Subreddit / Author / RedditPost) + lineage links
  const subs = new Set(nodes.flatMap((n) => n.sourceSubreddits || []));
  for (const p of posts) subs.add(p.subreddit);
  for (const name of subs) {
    objects.push({ __type: "Subreddit", __backingDataset: "reddit-mock", __sourceRefs: [], __ingestedAt: TS,
      name, category: subCategory(name) });
  }

  for (const p of posts) {
    const author = `u/auto_${p.id}`;
    objects.push({ __type: "Author", __backingDataset: "reddit-mock", __sourceRefs: [p.id], __ingestedAt: TS,
      username: author, karma: Math.round((p.score || 0) * 1.5), accountAgeDays: 900 });
    objects.push({ __type: "RedditPost", __backingDataset: "reddit-mock", __sourceRefs: [p.id], __ingestedAt: TS,
      id: p.id, title: p.title, body: p.snippet, score: p.score, numComments: Math.round((p.score || 0) / 8),
      createdAt: TS, url: `https://reddit.com/r/${p.subreddit}/${p.id}`, sentiment: p.sentiment });

    links.push({ type: "POSTED_IN", source: p.id, target: p.subreddit, props: {} });
    links.push({ type: "AUTHORED_BY", source: p.id, target: author, props: {} });
    for (const id of p.mentions || []) {
      links.push({ type: "MENTIONS", source: p.id, target: id, props: { weight: 0.6, sentiment: p.sentiment } });
      links.push({ type: "EVIDENCED_BY", source: id, target: p.id, props: {} }); // lineage: entity/signal ← post
    }
  }

  return { objects, links };
}
