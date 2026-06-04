/**
 * Eval golden set — labeled questions for measuring the GraphRAG engine.
 *
 * Each case declares the expected intent, anchor node(s), some related nodes
 * that SHOULD surface (recall check), and the expected supportStatus. Includes
 * adversarial no-anchor questions to measure the no-fabrication guarantee.
 *
 * This turns "the answers look good" into measurable metrics (see harness.js).
 */

export const GOLDEN_SET = [
  // ── why_trending ──
  { q: "Why is NVIDIA trending across finance and technology?", intent: "why_trending", anchors: ["nvidia"], relatedAny: ["tsmc", "earnings", "ai_datacenter", "nvda_earnings"], support: "supported" },
  { q: "Why is the Federal Reserve dominating discussion?", intent: "why_trending", anchors: ["federal_reserve"], relatedAny: ["interest_rates", "fomc_decision"], support: "supported" },
  { q: "Why is AI Capex trending?", intent: "why_trending", anchors: ["capex"], relatedAny: ["microsoft", "meta", "power_demand"], support: "supported" },
  { q: "Why is gold rising?", intent: "why_trending", anchors: ["gold"], relatedAny: ["treasury_yields", "dollar_strength"], support: "supported" },
  { q: "What is driving recession risk higher?", intent: "why_trending", anchors: ["recession_risk"], relatedAny: ["interest_rates"], support: "supported" },

  // ── negative_drivers ──
  { q: "Which topics are causing negative sentiment around Bitcoin?", intent: "negative_drivers", anchors: ["bitcoin"], relatedAny: ["interest_rates", "treasury_yields", "dollar_strength"], support: "supported" },
  { q: "What is driving bearish sentiment on Ethereum?", intent: "negative_drivers", anchors: ["ethereum"], relatedAny: [], support: "partial" }, // no negative IMPACTS into ETH → honest partial

  // ── emerging_risks ──
  { q: "What market risks are emerging from the discussion?", intent: "emerging_risks", anchors: ["recession_risk", "ai_bubble_risk"], relatedAny: ["recession_risk", "credit_risk", "liquidity_risk"], support: "supported" },

  // ── connected_orgs ──
  { q: "Which companies are connected to AI datacenter discussions?", intent: "connected_orgs", anchors: ["ai_datacenter"], relatedAny: ["nvidia", "openai", "microsoft"], support: "supported" },
  { q: "Which companies are connected to the semiconductor supply chain?", intent: "connected_orgs", anchors: ["semiconductor"], relatedAny: ["nvidia", "amd"], support: "supported" },
  { q: "Which companies are connected to OpenAI?", intent: "connected_orgs", anchors: ["openai"], relatedAny: ["microsoft", "sam_altman", "chatgpt"], support: "supported" },

  // ── impact_path ──
  { q: "How do interest rates affect Bitcoin?", intent: "impact_path", anchors: ["interest_rates", "bitcoin"], pathEnds: ["interest_rates", "bitcoin"], support: "partial" },
  { q: "How does TSMC affect NVIDIA?", intent: "impact_path", anchors: ["tsmc", "nvidia"], pathEnds: ["tsmc", "nvidia"], support: "partial" },

  // ── adversarial (no anchor → must NOT fabricate) ──
  { q: "What is the best pizza topping?", intent: null, anchors: [], support: "unsupported", adversarial: true },
  { q: "How tall is Mount Everest?", intent: null, anchors: [], support: "unsupported", adversarial: true },
  { q: "Who won the football game last night?", intent: null, anchors: [], support: "unsupported", adversarial: true },
];
