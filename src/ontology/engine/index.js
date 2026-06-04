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

export { buildOntologyContext, planQuery, buildBundle, buildVectorIndex, semanticSearch, defaultEmbedder };

/**
 * Answer a question against a live ontology store, grounded with evidence.
 * @param opts { index, embedder } — optional vector index enables HYBRID
 *   (lexical + semantic) anchor retrieval over contextual embeddings.
 */
export function answerWithGraphRAG(store, question, opts = {}) {
  const context = buildOntologyContext(store);
  const plan = planQuery(store, question, opts);
  const bundle = buildBundle(store, plan, context);
  return { question, ...bundle, retrieval: plan.retrieval, context: { hash: context.hash, objectCounts: context.objectCounts } };
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

/** Suggested questions that exercise each intent against the finance graph. */
export const ENGINE_QUESTIONS = [
  "Why is NVIDIA trending across finance and technology communities?",
  "Which topics are causing negative sentiment around Bitcoin?",
  "What market risks are emerging from Reddit discussions?",
  "Which companies are connected to AI datacenter discussions?",
  "How do interest rates affect Bitcoin?",
];
