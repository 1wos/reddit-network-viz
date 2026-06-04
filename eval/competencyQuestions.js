/**
 * Competency Questions (CQ) — ISO-704 / ontology-engineering practice.
 *
 * A CQ is a question the ontology MUST be able to answer to be "competent" for
 * its domain. Each CQ is a structured graph query that should return ≥ `min`
 * results — if it returns nothing, the ontology has a coverage gap. This tests
 * the *schema + data design*, distinct from the NL eval (which tests the engine).
 */

const out = (store, id) => store.neighbors(id).filter((n) => n.dir === "out");
const inn = (store, id) => store.neighbors(id).filter((n) => n.dir === "in");
const via = (list, type) => list.filter((n) => n.type === type);

export const COMPETENCY_QUESTIONS = [
  { id: "cq1", q: "Which entities does export-control policy impact?",
    run: (s) => via(out(s, "export_controls"), "IMPACTS").map((n) => n.node.id) },
  { id: "cq2", q: "Which risk signals escalate toward recession risk?",
    run: (s) => via(inn(s, "recession_risk"), "ESCALATES").map((n) => n.node.id) },
  { id: "cq3", q: "Which assets/topics does interest-rate policy impact?",
    run: (s) => via(out(s, "interest_rates"), "IMPACTS").map((n) => n.node.id) },
  { id: "cq4", q: "What source posts back the AI-bubble risk signal?",
    run: (s) => s.getLinks({ type: "EVIDENCED_BY", source: "ai_bubble_risk" }).map((l) => l.target) },
  { id: "cq5", q: "Which events is NVIDIA related to?",
    run: (s) => via(out(s, "nvidia"), "RELATED_TO_EVENT").map((n) => n.node.id) },
  { id: "cq6", q: "Which products co-occur with NVIDIA?",
    run: (s) => s.neighbors("nvidia").filter((n) => n.type === "CO_OCCURS_WITH" && n.node.__type === "Product").map((n) => n.node.id) },
  { id: "cq7", q: "Which people are tied to organizations?",
    run: (s) => s.all("Person").filter((p) => s.neighbors(p.id).some((n) => n.type === "CO_OCCURS_WITH" && n.node.__type === "Organization")).map((p) => p.id) },
  { id: "cq8", q: "Which sentiment/risk signals contradict each other?",
    run: (s) => s.getLinks({ type: "CONTRADICTS" }).map((l) => `${l.source}~${l.target}`) },
  { id: "cq9", q: "What drives bearish sentiment on Bitcoin (negative impacts)?",
    run: (s) => inn(s, "bitcoin").filter((n) => n.type === "IMPACTS" && n.props?.polarity === "negative").map((n) => n.node.id) },
  { id: "cq10", q: "Which subreddits is the AI-datacenter topic discussed in?",
    run: (s) => (s.get("ai_datacenter")?.sourceSubreddits || []) },
];

export function runCQ(store) {
  return COMPETENCY_QUESTIONS.map((cq) => {
    const results = cq.run(store) || [];
    return { id: cq.id, q: cq.q, count: results.length, pass: results.length >= 1, sample: results.slice(0, 3) };
  });
}
