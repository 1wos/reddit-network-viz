/**
 * Ontology — Object Type registry (Palantir-style)
 *
 * Types are SCHEMA only (no instances). Each ObjectType declares a primary
 * key, a title property, an optional base type, and a typed property schema.
 * Instances live in the ontology store and are validated against these types.
 *
 * Property descriptor: { type, required?, default?, enum?, range?, ref?, of? }
 *   type: "string" | "int" | "double" | "bool" | "timestamp" | "enum" | "array" | "ref"
 */

/* Shared base property sets (spread into concrete subtypes). */
const ENTITY_PROPS = {
  id:               { type: "string", required: true },
  label:            { type: "string", required: true },
  frequency:        { type: "int", default: 0 },
  sentiment:        { type: "double", range: [-1, 1] },
  confidence:       { type: "double", range: [0, 1] },
  trend:            { type: "array", of: "int" },
  shortSummary:     { type: "string" },
  sourceSubreddits: { type: "array", of: "string" },
};

const SIGNAL_PROPS = {
  id:               { type: "string", required: true },
  label:            { type: "string", required: true },
  magnitude:        { type: "double", range: [0, 1], required: true },
  confidence:       { type: "double", range: [0, 1] },
  status:           { type: "enum", enum: ["open", "ack", "closed"], default: "open" },
  evidenceCount:    { type: "int", default: 0 },
  createdAt:        { type: "timestamp" },
  sourceSubreddits: { type: "array", of: "string" },
};

export const OBJECT_TYPES = {
  /* ── Abstract bases ── */
  Entity: { apiName: "Entity", abstract: true, pk: "id", titleProp: "label", properties: ENTITY_PROPS },
  Signal: { apiName: "Signal", abstract: true, pk: "id", titleProp: "label", properties: SIGNAL_PROPS },

  /* ── Entity subtypes ── */
  Organization: {
    apiName: "Organization", base: "Entity", pk: "id", titleProp: "label",
    properties: {
      ...ENTITY_PROPS,
      ticker: { type: "string" },
      domain: { type: "string" },
      sector: { type: "enum", enum: ["tech", "finance", "energy", "consumer", "health", "other"] },
    },
  },
  Product: {
    apiName: "Product", base: "Entity", pk: "id", titleProp: "label",
    properties: { ...ENTITY_PROPS, maker: { type: "ref", ref: "Organization" } },
  },
  Person: {
    apiName: "Person", base: "Entity", pk: "id", titleProp: "label",
    properties: { ...ENTITY_PROPS, role: { type: "string" }, affiliation: { type: "ref", ref: "Organization" } },
  },
  AssetOrTicker: {
    apiName: "AssetOrTicker", base: "Entity", pk: "id", titleProp: "label",
    properties: {
      ...ENTITY_PROPS,
      ticker: { type: "string", required: true },
      assetClass: { type: "enum", enum: ["equity", "crypto", "etf", "commodity", "fx"], required: true },
      price: { type: "double" },        // ← price API
      changePct: { type: "double" },    // ← price API
      volatility: { type: "double" },   // ← price API
    },
  },

  /* ── Standalone ── */
  Topic: {
    apiName: "Topic", pk: "id", titleProp: "label",
    properties: {
      ...ENTITY_PROPS,
      category: { type: "enum", enum: ["macro", "markets", "crypto", "ai", "policy", "other"] },
    },
  },
  Subreddit: {
    apiName: "Subreddit", pk: "name", titleProp: "name",
    properties: {
      name: { type: "string", required: true },
      category: { type: "enum", enum: ["finance", "technology", "worldnews", "science", "gaming", "other"] },
      subscribers: { type: "int" },
      communitySentiment: { type: "double", range: [-1, 1] },
    },
  },
  Author: {
    apiName: "Author", pk: "username", titleProp: "username",
    properties: {
      username: { type: "string", required: true },
      karma: { type: "int" },
      accountAgeDays: { type: "int" },
    },
  },
  RedditPost: {
    apiName: "RedditPost", pk: "id", titleProp: "title",
    properties: {
      id: { type: "string", required: true },
      title: { type: "string", required: true },
      body: { type: "string" },
      score: { type: "int" },
      numComments: { type: "int" },
      createdAt: { type: "timestamp" },
      url: { type: "string" },
      sentiment: { type: "double", range: [-1, 1] },
    },
  },
  Event: {
    apiName: "Event", pk: "id", titleProp: "label",
    properties: {
      id: { type: "string", required: true },
      label: { type: "string", required: true },
      eventType: { type: "enum", enum: ["earnings", "fomc", "disclosure", "product", "macro"], required: true },
      scheduledAt: { type: "timestamp" },
      status: { type: "enum", enum: ["upcoming", "live", "past"], default: "upcoming" },
      confidence: { type: "double", range: [0, 1] },
      sourceSubreddits: { type: "array", of: "string" },
    },
  },

  /* ── Signal subtypes ── */
  SentimentSignal: {
    apiName: "SentimentSignal", base: "Signal", pk: "id", titleProp: "label",
    properties: {
      ...SIGNAL_PROPS,
      direction: { type: "enum", enum: ["positive", "negative"], required: true },
      delta: { type: "double" },
    },
  },
  RiskSignal: {
    apiName: "RiskSignal", base: "Signal", pk: "id", titleProp: "label",
    properties: {
      ...SIGNAL_PROPS,
      horizon: { type: "enum", enum: ["near", "mid", "long"] },
      riskType: { type: "enum", enum: ["market", "credit", "liquidity", "concentration", "macro"], required: true },
    },
  },

  /* ── Operational object (created by Actions) ── */
  Watchlist: {
    apiName: "Watchlist", pk: "id", titleProp: "label",
    properties: {
      id: { type: "string", required: true },
      label: { type: "string", required: true },
      entityIds: { type: "array", of: "string", default: [] },
      createdAt: { type: "timestamp" },
    },
  },
};

export const ENTITY_SUBTYPES = ["Organization", "Product", "Person", "AssetOrTicker"];
export const SIGNAL_SUBTYPES = ["SentimentSignal", "RiskSignal"];

export const objectType = (name) => OBJECT_TYPES[name] || null;
export const isEntityType = (name) => ENTITY_SUBTYPES.includes(name) || name === "Topic";
export const isSignalType = (name) => SIGNAL_SUBTYPES.includes(name);
