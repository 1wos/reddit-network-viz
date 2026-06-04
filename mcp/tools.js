/**
 * MCP tool layer (SDK-agnostic) — exposes the ontology GraphRAG engine as a set
 * of callable tools over a structured context protocol. Kept free of the MCP
 * SDK so the handlers can be unit-tested directly; server.js wires these to a
 * stdio transport.
 *
 * Tools:
 *   ontology_answer    — grounded GraphRAG answer (+supportStatus, evidence, missing)
 *   ontology_lineage   — EVIDENCED_BY lineage for a node (why it exists / sources)
 *   ontology_neighbors — typed relationships of a node
 *   ontology_action    — kinetic write-back (acknowledge/escalate/watchlist/annotate)
 *   ontology_briefing  — Daily Social Signal Brief
 *   ontology_catalog   — object/link type catalog + live counts (the contract)
 */

import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { answerWithGraphRAG, buildVectorIndex, semanticSearch } from "../src/ontology/engine/index.js";
import { buildOntologyContext } from "../src/ontology/engine/ontologyContext.js";
import { traceLineage } from "../src/ontology/lineage.js";
import { generateBriefing } from "../src/ontology/graphRagEngine.js";
import { getFinanceOntology } from "../src/ontology/mockOntologyData.js";
import { OBJECT_TYPES } from "../src/ontology/types/objectTypes.js";
import { LINK_TYPES } from "../src/ontology/types/linkTypes.js";

export function createOntologyTools() {
  const store = createStore(buildUsFinanceDataset());
  const index = buildVectorIndex(store);               // contextual embeddings for hybrid retrieval
  const financeData = getFinanceOntology();

  const trimAnswer = (a) => ({
    intent: a.intent, supportStatus: a.supportStatus, retrieval: a.retrieval, confidence: a.confidence,
    summary: a.summary, missingSlots: a.missingSlots,
    relatedNodes: a.relatedNodes, path: a.path?.map((s) => s.label),
    evidence: a.evidence.map((e) => ({ title: e.title, subreddit: e.subreddit, sentiment: e.sentiment })),
    contextHash: a.context?.hash,
  });

  const TOOLS = {
    ontology_answer: {
      description: "Grounded GraphRAG answer over the finance ontology (HYBRID lexical+semantic retrieval). Returns summary, supportStatus (supported|partial|unsupported), evidence and any missing slots.",
      input: { question: { type: "string", required: true } },
      handler: ({ question }) => trimAnswer(answerWithGraphRAG(store, question, { index })),
    },
    ontology_semantic_search: {
      description: "Semantic vector search over contextual entity embeddings. Returns top-k {id,label,type,score}.",
      input: { query: { type: "string", required: true }, k: { type: "number", required: false } },
      handler: ({ query, k }) => semanticSearch(index, query, k || 5).map((h) => ({ id: h.id, ...h.meta, score: Math.round(h.score * 1000) / 1000 })),
    },
    ontology_lineage: {
      description: "Evidence lineage for a node id: source posts (EVIDENCED_BY), their authors and subreddits.",
      input: { id: { type: "string", required: true } },
      handler: ({ id }) => traceLineage(store, id) || { error: `unknown node ${id}` },
    },
    ontology_neighbors: {
      description: "Typed, directed relationships of a node id.",
      input: { id: { type: "string", required: true } },
      handler: ({ id }) => ({
        id,
        neighbors: store.neighbors(id).map((n) => ({ id: n.node.id, label: n.node.label, type: n.node.__type, rel: n.type, dir: n.dir, props: n.props })),
      }),
    },
    ontology_action: {
      description: "Kinetic write-back. action ∈ {acknowledgeSignal, escalateRisk, createWatchlist, addToWatchlist, annotateEvidence}; params per the action schema.",
      input: { action: { type: "string", required: true }, params: { type: "object", required: false } },
      handler: ({ action, params }) => {
        try {
          const result = store.dispatch(action, params || {});
          return { ok: true, result: typeof result === "string" ? result : "applied", historyLen: store.history().length };
        } catch (e) { return { ok: false, error: e.message }; }
      },
    },
    ontology_briefing: {
      description: "Generate a Daily Social Signal Brief: top trending, sentiment shift, emerging risk, communities, bullets.",
      input: {},
      handler: () => generateBriefing(financeData, "finance"),
    },
    ontology_catalog: {
      description: "The ontology contract: object types, link types, and live instance counts + context hash.",
      input: {},
      handler: () => {
        const ctx = buildOntologyContext(store);
        return {
          objectTypes: Object.keys(OBJECT_TYPES).filter((t) => !OBJECT_TYPES[t].abstract),
          linkTypes: Object.keys(LINK_TYPES),
          objectCounts: ctx.objectCounts, linkCounts: ctx.linkCounts, contextHash: ctx.hash,
        };
      },
    },
  };

  return {
    store,
    names: () => Object.keys(TOOLS),
    spec: (name) => TOOLS[name],
    call: (name, args = {}) => {
      const t = TOOLS[name];
      if (!t) throw new Error(`unknown tool ${name}`);
      return t.handler(args);
    },
    all: TOOLS,
  };
}
