/**
 * Engine — facade
 *
 * The canonical, store-native GraphRAG path: question → ontology context →
 * plan (intent/slots/subgraph) → grounded evidence bundle. Deterministic today;
 * the same (store, question) → bundle contract can later be served by an LLM /
 * MCP tool without changing callers.
 */

import { buildOntologyContext } from "./ontologyContext.js";
import { planQuery } from "./queryPlanner.js";
import { buildBundle } from "./evidenceBundle.js";
import { buildVectorIndex, semanticSearch, defaultEmbedder } from "../embeddings/index.js";
import { answerSynthesisPrompt } from "../llm/prompts.js";
import { defaultVocab } from "../vocab.js";
import { evaluateGuard, guardAllRiskSignals, RULE_SETS } from "../symbolic/guard.js";

export { buildOntologyContext, planQuery, buildBundle, buildVectorIndex, semanticSearch, defaultEmbedder };
export { evaluateGuard, guardAllRiskSignals, RULE_SETS };

/**
 * Answer a question against a live ontology store, grounded with evidence.
 * @param opts { index, embedder } — optional vector index enables HYBRID
 *   (lexical + semantic) anchor retrieval over contextual embeddings.
 */
export function answerWithGraphRAG(store, question, opts = {}) {
  const context = buildOntologyContext(store);
  const plan = planQuery(store, question, { vocab: defaultVocab, ...opts });
  const bundle = buildBundle(store, plan, context);
  return { question, ...bundle, retrieval: plan.retrieval, reranked: plan.reranked, context: { hash: context.hash, objectCounts: context.objectCounts } };
}

/**
 * Same as answerWithGraphRAG, but if `opts.llm` is available, synthesize the
 * final prose with the LLM using the (deterministic) evidence bundle as grounded
 * context. Falls back to the deterministic summary on absence or error. This is
 * the RAG *generation* step layered on top of grounded retrieval.
 */
export async function answerWithGraphRAGLLM(store, question, opts = {}) {
  const answer = answerWithGraphRAG(store, question, opts);
  if (opts.llm?.available) {
    try {
      const { system, user } = answerSynthesisPrompt(question, answer);
      const text = await opts.llm.generate({ system, user });
      return { ...answer, summary: text.trim(), synthesizedBy: "llm" };
    } catch (e) {
      return { ...answer, synthesizedBy: "deterministic", llmError: e.message };
    }
  }
  return { ...answer, synthesizedBy: "deterministic" };
}

/**
 * Neurosymbolic loop, closed: GraphRAG *proposes* (System 1 / neural retrieval),
 * the Symbolic Guard *checks* (System 2). Runs the answer, pulls the RiskSignal
 * candidates it surfaced (anchors + slot/related nodes), guards each one, and
 * returns the answer enriched with `guardrails` (per-candidate verdicts) and
 * `actionable` (only the candidates that passed). This is the single pipeline the
 * deck describes: the LLM/retrieval suggestion is never surfaced as actionable
 * until the rules clear it.
 */
export function answerWithGuard(store, question, opts = {}) {
  const answer = answerWithGraphRAG(store, question, opts);
  const ruleSet = opts.ruleSet || "escalateRisk";
  const subjectType = RULE_SETS[ruleSet]?.subjectType || "RiskSignal";

  // Candidate ids the answer proposed, de-duped, kept only if they are the
  // guard's subject type (e.g. RiskSignal) — those are what we let the guard gate.
  const proposedIds = [
    ...answer.anchors.map((a) => a.id),
    ...answer.relatedNodes.map((n) => n.id),
    ...Object.values(answer.slots).flat().map((n) => n.id),
  ];
  const candidates = [...new Set(proposedIds)].filter((id) => store.get(id)?.__type === subjectType);

  const guardrails = candidates.map((id) => evaluateGuard(store, ruleSet, id));
  const actionable = guardrails.filter((v) => v.decision === "valid").map((v) => v.subject);

  return { ...answer, guardrails, actionable };
}

/** Suggested questions that exercise each intent against the finance graph. */
export const ENGINE_QUESTIONS = [
  "Why is NVIDIA trending across finance and technology communities?",
  "Which topics are causing negative sentiment around Bitcoin?",
  "What market risks are emerging from Reddit discussions?",
  "Which companies are connected to AI datacenter discussions?",
  "How do interest rates affect Bitcoin?",
];
