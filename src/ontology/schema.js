/**
 * RedditPulse Ontology — Schema
 *
 * Defines the entity (node) and relationship (edge) types that turn the
 * keyword network into an ontology. Each type carries presentation metadata
 * (a palette color *key* — resolved against the active theme `C` at render
 * time — plus a subtle shape hint and glyph) so the graph can distinguish
 * types WITHOUT hard-coding theme colors here.
 *
 * Nothing in this file imports React or D3; it is pure data + helpers so it
 * can be reused by the graph, the GraphRAG engine, and the panels alike.
 */

/* ─── Node (Entity) Types ───
   colorKey  → a key present in BOTH the DARK and LIGHT palettes.
   shape     → "circle" (default) | "ring-dashed" (signals/events stand out).
   glyph     → tiny label shown in the type chip. */
export const NODE_TYPES = {
  Subreddit:     { key: "Subreddit",     label: "Community",   colorKey: "blue",   shape: "circle",      glyph: "r/" },
  Post:          { key: "Post",          label: "Post",        colorKey: "neu",    shape: "circle",      glyph: "≡"  },
  Topic:         { key: "Topic",         label: "Topic",       colorKey: "cyan",   shape: "circle",      glyph: "#"  },
  Organization:  { key: "Organization",  label: "Org",         colorKey: "purple", shape: "circle",      glyph: "◈"  },
  Product:       { key: "Product",       label: "Product",     colorKey: "pink",   shape: "circle",      glyph: "▢"  },
  Person:        { key: "Person",        label: "Person",      colorKey: "yellow", shape: "circle",      glyph: "@"  },
  AssetOrTicker: { key: "AssetOrTicker", label: "Asset",       colorKey: "accent", shape: "circle",      glyph: "$"  },
  Event:         { key: "Event",         label: "Event",       colorKey: "blue",   shape: "ring-dashed", glyph: "✦"  },
  SentimentSignal:{key: "SentimentSignal",label:"Sentiment",   colorKey: "pos",    shape: "ring-dashed", glyph: "±"  },
  RiskSignal:    { key: "RiskSignal",    label: "Risk",        colorKey: "neg",    shape: "ring-dashed", glyph: "⚠"  },
};

export const NODE_TYPE_LIST = Object.keys(NODE_TYPES);

/* ─── Relationship (Edge) Types ───
   Directed semantic links. `label` is shown in evidence/lineage views. */
export const EDGE_TYPES = {
  MENTIONS:          { key: "MENTIONS",          label: "mentions",          directed: true  },
  DISCUSSED_IN:      { key: "DISCUSSED_IN",      label: "discussed in",      directed: true  },
  CO_OCCURS_WITH:    { key: "CO_OCCURS_WITH",    label: "co-occurs with",    directed: false },
  RELATED_TO_EVENT:  { key: "RELATED_TO_EVENT",  label: "related to event",  directed: true  },
  IMPACTS:           { key: "IMPACTS",           label: "impacts",           directed: true  },
  ESCALATES:         { key: "ESCALATES",         label: "escalates",         directed: true  },
  CONTRADICTS:       { key: "CONTRADICTS",       label: "contradicts",       directed: false },
  TRENDING_WITH:     { key: "TRENDING_WITH",     label: "trending with",     directed: false },
  EVIDENCED_BY:      { key: "EVIDENCED_BY",      label: "evidenced by",      directed: true  },
};

export const EDGE_TYPE_LIST = Object.keys(EDGE_TYPES);

/** Metadata for a node type (falls back to Topic for unknown/legacy nodes). */
export function nodeTypeMeta(type) {
  return NODE_TYPES[type] || NODE_TYPES.Topic;
}

/** Metadata for an edge type (falls back to CO_OCCURS_WITH). */
export function edgeTypeMeta(type) {
  return EDGE_TYPES[type] || EDGE_TYPES.CO_OCCURS_WITH;
}

/** Resolve a node type to a concrete color against an active palette `C`. */
export function nodeTypeColor(type, C) {
  const m = nodeTypeMeta(type);
  return (C && C[m.colorKey]) || (C && C.accent) || "#f97316";
}

/**
 * Canonical node shape (documentation of the contract every node honors):
 *   { id, label, type, frequency, sentiment, trend[7], confidence,
 *     evidenceCount, shortSummary, ticker?, sourceSubreddits[] }
 * Canonical edge shape:
 *   { source, target, type, weight, confidence, evidenceCount }
 */
export const NODE_FIELDS = [
  "id", "label", "type", "frequency", "sentiment", "trend",
  "confidence", "evidenceCount", "shortSummary", "ticker", "sourceSubreddits",
];
export const EDGE_FIELDS = ["source", "target", "type", "weight", "confidence", "evidenceCount"];
