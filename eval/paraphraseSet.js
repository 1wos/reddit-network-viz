/**
 * Paraphrase eval set — questions that contain NO exact entity label/word, so
 * lexical retrieval MUST miss and only semantic (vector) retrieval can recover
 * them. Used by the retriever ablation benchmark to quantify hybrid's value.
 *
 * anchorsAny = acceptable top-anchor ids (semantic match is fuzzy by nature).
 */
export const PARAPHRASE_SET = [
  { q: "which firm leads accelerated computing hardware for model training", anchorsAny: ["nvidia", "amd", "semiconductor", "ai_datacenter", "blackwell_gpu", "h100_gpu"] },
  { q: "how the monetary authority's tightening shifts borrowing costs", anchorsAny: ["federal_reserve", "interest_rates", "treasury_yields", "jerome_powell"] },
  { q: "the foundry chokepoint for advanced chip fabrication", anchorsAny: ["tsmc", "semiconductor", "export_controls", "geopolitical_risk"] },
  { q: "spending surge on hyperscale compute facilities", anchorsAny: ["capex", "ai_datacenter", "power_demand", "openai", "microsoft"] },
  { q: "the safe-haven asset investors flee to during market stress", anchorsAny: ["gold", "risk_off"] },
  { q: "decentralized currency reacting to easing expectations", anchorsAny: ["bitcoin", "ethereum", "crypto_fear", "rate_cut_optimism", "spot_btc_etf"] },
];

/* off-domain questions that must stay UNSUPPORTED under any retriever config */
export const ADVERSARIAL = [
  "What is the best pizza topping?",
  "How tall is Mount Everest?",
  "Who won the football game last night?",
];
