/**
 * RedditPulse Ontology — GraphRAG Engine
 *
 * Deterministic, dependency-free reasoning over the ontology graph. No LLM is
 * required: every function walks the nodes/edges/posts to produce structured,
 * evidence-backed answers. The signatures are intentionally shaped so this
 * module could later be swapped for an LLM / MCP tool returning the same JSON.
 */

import { edgeTypeMeta } from "./schema.js";

/* ─── Small graph helpers ─── */

const idOf = (x) => (typeof x === "object" && x ? x.id : x);

/** Trend momentum: last value minus first, and a normalized % change. */
export function trendDelta(node) {
  const t = node?.trend || [];
  if (t.length < 2) return { abs: 0, pct: 0 };
  const abs = t[t.length - 1] - t[0];
  const pct = t[0] ? Math.round((abs / t[0]) * 100) : 0;
  return { abs, pct };
}

/** All edges touching a node, normalized to {node, edgeType, weight, direction}. */
export function neighbors(data, id) {
  const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  const out = [];
  for (const e of data.edges) {
    const s = idOf(e.source);
    const t = idOf(e.target);
    if (s === id && byId[t]) out.push({ node: byId[t], edgeType: e.type, weight: e.weight, confidence: e.confidence, direction: "out" });
    else if (t === id && byId[s]) out.push({ node: byId[s], edgeType: e.type, weight: e.weight, confidence: e.confidence, direction: "in" });
  }
  return out.sort((a, b) => (b.weight || 0) - (a.weight || 0));
}

/** Posts whose `mentions` include this node id. */
export function evidenceFor(data, id) {
  return (data.posts || []).filter((p) => (p.mentions || []).includes(id));
}

/** Resolve free-text to nodes by label / id / ticker substring match. */
function matchNodes(data, text) {
  const q = (text || "").toLowerCase();
  return data.nodes.filter((n) => {
    const hay = [n.label, n.id, n.ticker].filter(Boolean).join(" ").toLowerCase();
    return q.includes(n.label.toLowerCase()) || hay.split(/\W+/).some((w) => w.length > 2 && q.includes(w));
  });
}

/* ─── Node evidence / lineage ─── */

/**
 * Lineage for a single node: why it's trending, top related nodes (with the
 * relationship type), evidence count, source snippets, sentiment/trend deltas.
 */
export function getNodeEvidence(data, node) {
  if (!node) return null;
  const rel = neighbors(data, node.id).slice(0, 6).map((r) => ({
    id: r.node.id,
    label: r.node.label,
    type: r.node.type,
    edgeType: r.edgeType,
    edgeLabel: edgeTypeMeta(r.edgeType).label,
    weight: r.weight,
    direction: r.direction,
  }));
  const snippets = evidenceFor(data, node.id).slice(0, 4).map((p) => ({
    title: p.title,
    snippet: p.snippet,
    subreddit: p.subreddit,
    sentiment: p.sentiment,
    score: p.score,
  }));
  const td = trendDelta(node);
  const avgSent = data.nodes.reduce((a, n) => a + n.sentiment, 0) / data.nodes.length;

  const drivers = rel.filter((r) => r.edgeType === "IMPACTS" || r.edgeType === "ESCALATES" || r.edgeType === "RELATED_TO_EVENT");
  const why =
    `${node.label} is ${td.abs >= 0 ? "rising" : "cooling"} (${td.pct >= 0 ? "+" : ""}${td.pct}% over 7 days) ` +
    `with ${node.frequency} mentions across ${(node.sourceSubreddits || []).map((s) => "r/" + s).join(", ") || "the community"}. ` +
    (drivers.length
      ? `It is being driven by ${drivers.slice(0, 2).map((d) => `${d.edgeLabel} ${d.label}`).join(" and ")}.`
      : `It co-occurs most with ${rel.slice(0, 2).map((r) => r.label).join(" and ") || "few other topics"}.`);

  return {
    node,
    whyTrending: why,
    trendDelta: td,
    sentimentDelta: Math.round((node.sentiment - avgSent) * 100) / 100,
    related: rel,
    evidenceCount: node.evidenceCount ?? snippets.length,
    snippets,
    confidence: node.confidence ?? 0.7,
  };
}

/* ─── GraphRAG question answering ─── */

export const PRESET_QUESTIONS = [
  "Why is NVIDIA trending across finance and technology communities?",
  "Which topics are causing negative sentiment around Bitcoin?",
  "What market risks are emerging from Reddit discussions?",
  "Which companies are connected to AI datacenter discussions?",
];

function summarizeNodes(ns) {
  return ns.slice(0, 5).map((n) => ({ id: n.id, label: n.label, type: n.type, sentiment: n.sentiment }));
}

function collectEvidence(data, ids, limit = 4) {
  const seen = new Set();
  const out = [];
  for (const p of data.posts || []) {
    if ((p.mentions || []).some((m) => ids.includes(m)) && !seen.has(p.id)) {
      seen.add(p.id);
      out.push({ title: p.title, snippet: p.snippet, subreddit: p.subreddit, sentiment: p.sentiment });
    }
    if (out.length >= limit) break;
  }
  return out;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Deterministic GraphRAG answer.
 * @returns {{question,summary,confidence,relatedNodes,evidence,followUps}}
 */
export function answerQuestion(data, question) {
  const q = (question || "").toLowerCase();
  const intentNegative = /(negativ|fear|risk|bear|crash|drama|concern|down)/.test(q);
  const intentRisk = /(risk|recession|bubble|danger|threat|crash)/.test(q);
  const intentConnected = /(connect|related|linked|associat|tied|companies|who)/.test(q);

  let focus = matchNodes(data, q);

  // Intent: emerging market risks → surface RiskSignal nodes.
  if (intentRisk && (!focus.length || /market risk|risks/.test(q))) {
    const risks = data.nodes
      .filter((n) => n.type === "RiskSignal" || n.sentiment < -0.45)
      .sort((a, b) => a.sentiment - b.sentiment);
    const ids = risks.map((n) => n.id);
    return {
      question,
      summary:
        risks.length
          ? `The strongest emerging risk signals are ${risks.slice(0, 3).map((n) => n.label).join(", ")}. ` +
            `They are escalating through links such as ${risks
              .flatMap((n) => neighbors(data, n.id).filter((r) => r.edgeType === "ESCALATES" || r.edgeType === "IMPACTS"))
              .slice(0, 2)
              .map((r) => `${r.node.label}`)
              .join(" and ") || "rate and demand channels"}.`
          : "No distinct risk signals are dominating the discussion right now.",
      confidence: round2(avg(risks.slice(0, 3).map((n) => n.confidence ?? 0.7)) || 0.6),
      relatedNodes: summarizeNodes(risks),
      evidence: collectEvidence(data, ids),
      followUps: [
        "What is driving recession risk higher?",
        "Which assets are most exposed to these risks?",
        "Is rate-cut optimism offsetting the risk signals?",
      ],
    };
  }

  if (!focus.length) {
    // Fall back to the most active nodes.
    focus = [...data.nodes].sort((a, b) => b.frequency - a.frequency).slice(0, 1);
  }

  const primary = focus.sort((a, b) => b.frequency - a.frequency)[0];
  const rel = neighbors(data, primary.id);

  // Filter related set by intent.
  let related = rel.map((r) => r.node);
  if (intentNegative) related = related.filter((n) => n.sentiment < 0);
  if (intentConnected) related = rel.filter((r) => r.node.type === "Organization" || r.node.type === "Person" || r.node.type === "Product").map((r) => r.node);
  if (!related.length) related = rel.map((r) => r.node);

  const focusIds = [primary.id, ...related.map((n) => n.id)];
  const td = trendDelta(primary);
  const relLabels = rel.slice(0, 3).map((r) => `${edgeTypeMeta(r.edgeType).label} ${r.node.label}`).join(", ");

  const summary =
    intentNegative
      ? `Negative sentiment around ${primary.label} is concentrated in ${related.slice(0, 3).map((n) => n.label).join(", ") || "macro factors"}. ` +
        `${primary.label} is ${td.pct >= 0 ? "still up" : "down"} ${Math.abs(td.pct)}% on 7-day momentum but the bearish links dominate the threads.`
      : intentConnected
      ? `${primary.label} is directly connected to ${related.slice(0, 4).map((n) => n.label).join(", ") || "few entities"} via ${relLabels || "co-occurrence"}.`
      : `${primary.label} is trending (${td.pct >= 0 ? "+" : ""}${td.pct}% / 7d, ${primary.frequency} mentions) because it ${relLabels || "co-occurs with several topics"}. ` +
        `Sentiment is ${primary.sentiment > 0.2 ? "constructive" : primary.sentiment < -0.2 ? "cautious" : "mixed"}.`;

  return {
    question,
    summary,
    confidence: round2(primary.confidence ?? 0.75),
    relatedNodes: summarizeNodes(related),
    evidence: collectEvidence(data, focusIds),
    followUps: buildFollowUps(primary, related),
  };
}

function buildFollowUps(primary, related) {
  const r0 = related[0]?.label;
  const r1 = related[1]?.label;
  return [
    r0 && `How does ${r0} affect ${primary.label}?`,
    r1 && `What is the sentiment trend for ${r1}?`,
    `Which events are driving ${primary.label}?`,
  ].filter(Boolean);
}

/* ─── Daily Social Signal Brief ─── */

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Generate a decision-grade briefing from the graph.
 * @returns {{subreddit,topTrending,sentimentShift,emergingRisk,communities,bullets,evidenceNote}}
 */
export function generateBriefing(data, sub) {
  const nodes = data.nodes;

  const topTrending = [...nodes].sort((a, b) => trendDelta(b).abs - trendDelta(a).abs)[0];
  const avgSent = avg(nodes.map((n) => n.sentiment));
  const sentimentShift = [...nodes].sort(
    (a, b) => Math.abs(b.sentiment - avgSent) - Math.abs(a.sentiment - avgSent)
  )[0];
  const emergingRisk =
    [...nodes].filter((n) => n.type === "RiskSignal").sort((a, b) => trendDelta(b).abs - trendDelta(a).abs)[0] ||
    [...nodes].sort((a, b) => a.sentiment - b.sentiment)[0];

  const communities = Array.from(
    new Set(nodes.flatMap((n) => n.sourceSubreddits || [sub]))
  );

  const ttd = trendDelta(topTrending);
  const rtd = trendDelta(emergingRisk);
  const shiftDir = sentimentShift.sentiment >= avgSent ? "more positive" : "more negative";

  const bullets = [
    `📈 ${topTrending.label} is the top mover, up ${ttd.pct >= 0 ? "+" : ""}${ttd.pct}% over 7 days (${topTrending.frequency} mentions).`,
    `🎯 Sentiment is skewing ${shiftDir} on ${sentimentShift.label} (${sentimentShift.sentiment.toFixed(2)} vs ${avgSent.toFixed(2)} avg).`,
    `⚠️ ${emergingRisk.label} is the key emerging risk signal, ${rtd.abs >= 0 ? "rising" : "easing"} ${rtd.pct >= 0 ? "+" : ""}${rtd.pct}%.`,
    `🌐 Conversation spans ${communities.map((c) => "r/" + c).join(", ")}.`,
    `🔗 Watch the link ${topTrending.label} → ${neighbors(data, topTrending.id)[0]?.node.label || "related topics"} as the cross-community bridge.`,
  ];

  return {
    subreddit: sub,
    topTrending,
    sentimentShift: { node: sentimentShift, delta: round2(sentimentShift.sentiment - avgSent) },
    emergingRisk,
    communities,
    bullets,
    evidenceNote: `Backed by ${data.posts?.length || 0} source posts across ${communities.length} communities; avg confidence ${round2(
      avg(nodes.map((n) => n.confidence ?? 0.7))
    )}.`,
  };
}
