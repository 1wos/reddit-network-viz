/**
 * Ontology — Link Type registry (Palantir-style)
 *
 * Each LinkType declares endpoint object types, cardinality, an inverse name,
 * and optional typed link properties. `EVIDENCED_BY → RedditPost` is the
 * lineage backbone (a signal/entity points back to its source posts).
 *
 * Descriptor: { apiName, from, to[], cardinality, inverse?, symmetric?, linkProps? }
 *   cardinality: "one-to-one" | "many-to-one" | "one-to-many" | "many-to-many"
 */

const ENTITY_LIKE = ["Organization", "Product", "Person", "AssetOrTicker", "Topic"];
const SIGNAL_LIKE = ["SentimentSignal", "RiskSignal"];
const MENTIONABLE = [...ENTITY_LIKE, ...SIGNAL_LIKE, "Event"]; // posts mention entities, signals AND events

export const LINK_TYPES = {
  POSTED_IN: {
    apiName: "POSTED_IN", from: "RedditPost", to: ["Subreddit"],
    cardinality: "many-to-one", inverse: "HAS_POSTS",
  },
  AUTHORED_BY: {
    apiName: "AUTHORED_BY", from: "RedditPost", to: ["Author"],
    cardinality: "many-to-one", inverse: "AUTHORED",
  },
  MENTIONS: {
    apiName: "MENTIONS", from: "RedditPost", to: MENTIONABLE,
    cardinality: "many-to-many", inverse: "MENTIONED_IN",
    linkProps: { weight: { type: "double" }, sentiment: { type: "double", range: [-1, 1] } },
  },
  DISCUSSED_IN: {
    apiName: "DISCUSSED_IN", from: "Topic", to: ["Subreddit"],
    cardinality: "many-to-many", inverse: "DISCUSSES",
  },
  CO_OCCURS_WITH: {
    apiName: "CO_OCCURS_WITH", from: ENTITY_LIKE, to: ENTITY_LIKE,
    cardinality: "many-to-many", symmetric: true,
    linkProps: { count: { type: "int" }, pmi: { type: "double" } },
  },
  RELATED_TO_EVENT: {
    apiName: "RELATED_TO_EVENT", from: ENTITY_LIKE, to: ["Event"],
    cardinality: "many-to-many", inverse: "EVENT_OF",
  },
  IMPACTS: {
    apiName: "IMPACTS", from: [...ENTITY_LIKE, ...SIGNAL_LIKE, "Event"], to: [...ENTITY_LIKE, ...SIGNAL_LIKE],
    cardinality: "many-to-many", inverse: "IMPACTED_BY",
    linkProps: { polarity: { type: "enum", enum: ["positive", "negative"] }, strength: { type: "double" } },
  },
  ESCALATES: {
    apiName: "ESCALATES", from: [...SIGNAL_LIKE, "Topic"], to: SIGNAL_LIKE,
    cardinality: "many-to-many", inverse: "ESCALATED_BY",
  },
  CONTRADICTS: {
    apiName: "CONTRADICTS", from: SIGNAL_LIKE, to: SIGNAL_LIKE,
    cardinality: "many-to-many", symmetric: true,
  },
  TRENDING_WITH: {
    apiName: "TRENDING_WITH", from: [...ENTITY_LIKE, ...SIGNAL_LIKE], to: [...ENTITY_LIKE, ...SIGNAL_LIKE],
    cardinality: "many-to-many", symmetric: true,
  },
  EVIDENCED_BY: {
    apiName: "EVIDENCED_BY", from: [...ENTITY_LIKE, ...SIGNAL_LIKE, "Event"], to: ["RedditPost"],
    cardinality: "many-to-many", inverse: "EVIDENCE_FOR",
  },
};

export const linkType = (name) => LINK_TYPES[name] || null;
