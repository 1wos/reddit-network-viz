/**
 * Engine — Intent registry (declarative slot schema)
 *
 * Grounding-first retrieval: an answer is grounded only when
 * we map the question to an intent with explicit *required slots*, fill those
 * slots from the graph, and name what is still missing. Each intent declares:
 *   - patterns: regexes that vote for this intent
 *   - anchor:   how to resolve the focus node(s) — named entities, or all of a type
 *   - slots:    declarative graph traversals { via, dir, nodeTypes, linkPolarity }
 *   - pathfind: if true, also compute a path between two named anchors
 *
 * The query planner is generic over this schema — adding an intent is data, not code.
 */

export const INTENTS = [
  {
    id: "impact_path",
    label: "Impact path",
    patterns: [/how (?:does|do|would|can) .+ (?:affect|impact|influence|drive|move|hit)/i, /relationship between .+ and /i],
    anchor: { mode: "named", min: 2 },
    pathfind: true,
    slots: [
      { name: "drivers", label: "Mediating links", via: ["IMPACTS", "CO_OCCURS_WITH"], dir: "any" },
    ],
  },
  {
    id: "emerging_risks",
    label: "Emerging risks",
    patterns: [/(?:emerging|what|which|key|market|systemic).{0,20}risk/i, /risk.{0,20}(?:emerging|building|rising)/i, /what could go wrong/i],
    anchor: { mode: "allOfType", ofType: "RiskSignal" },
    slots: [
      { name: "escalation", label: "Escalation chain", via: ["ESCALATES"], dir: "any", required: true },
      { name: "exposed", label: "Exposed assets/topics", via: ["IMPACTS"], dir: "out" },
      { name: "drivers", label: "Risk drivers", via: ["IMPACTS"], dir: "in" },
    ],
  },
  {
    id: "negative_drivers",
    label: "Negative-sentiment drivers",
    patterns: [/(?:negative|bearish|fear|down|fall|drop|sell-?off|weak|concern|worr).{0,30}(?:around|about|on|for|in)?/i],
    anchor: { mode: "named" },
    slots: [
      { name: "bearish_impacts", label: "Bearish drivers", via: ["IMPACTS"], dir: "in", linkPolarity: "negative", required: true },
      { name: "risk_signals", label: "Linked risk/fear signals", via: ["TRENDING_WITH", "IMPACTS", "ESCALATES"], dir: "any", nodeTypes: ["RiskSignal", "SentimentSignal"] },
      { name: "cooccurs", label: "Co-occurring topics", via: ["CO_OCCURS_WITH"], dir: "any" },
    ],
  },
  {
    id: "connected_orgs",
    label: "Connected organizations",
    patterns: [/(?:which|what|name the).{0,30}(?:compan|organi[sz]ation|firm|player|name|maker|vendor)/i, /who (?:is|are) (?:connected|linked|related|involved|tied)/i],
    anchor: { mode: "named" },
    slots: [
      { name: "orgs", label: "Connected orgs/people/products", via: ["CO_OCCURS_WITH", "IMPACTS", "TRENDING_WITH"], dir: "any", nodeTypes: ["Organization", "Person", "Product"], required: true },
      { name: "events", label: "Related events", via: ["RELATED_TO_EVENT"], dir: "out" },
    ],
  },
  {
    id: "why_trending",
    label: "Why trending",
    patterns: [
      /why (?:is|are|does|do|did)/i,
      /what(?:'s| is| are)?\s+(?:driving|causing|behind|fuell?ing|powering)/i,
      /what.{0,20}(?:driv|behind|caus).{0,20}(?:trend|rally|move|surge|spike|rise)/i,
      /why .+ (?:trend|popular|hot|up|rising)/i,
    ],
    anchor: { mode: "named" },
    slots: [
      // "why is X trending" is explained by what it's causally/eventfully tied to
      { name: "drivers", label: "Drivers & events", via: ["IMPACTS", "RELATED_TO_EVENT"], dir: "any", required: true },
      { name: "cooccurs", label: "Trending alongside", via: ["CO_OCCURS_WITH", "TRENDING_WITH"], dir: "any" },
    ],
  },
];

/* Fallback when nothing matches: a general neighborhood overview. */
export const FALLBACK_INTENT = {
  id: "overview",
  label: "Overview",
  anchor: { mode: "named" },
  slots: [
    { name: "drivers", label: "Impacting / impacted", via: ["IMPACTS", "RELATED_TO_EVENT"], dir: "any", required: true },
    { name: "cooccurs", label: "Associated", via: ["CO_OCCURS_WITH", "TRENDING_WITH"], dir: "any" },
  ],
};

/** Score patterns and return the best-matching intent (or fallback). */
export function matchIntent(question) {
  const q = question || "";
  let best = null, bestScore = 0;
  for (const intent of INTENTS) {
    const score = intent.patterns.reduce((s, re) => s + (re.test(q) ? 1 : 0), 0);
    if (score > bestScore) { best = intent; bestScore = score; }
  }
  return best || FALLBACK_INTENT;
}
