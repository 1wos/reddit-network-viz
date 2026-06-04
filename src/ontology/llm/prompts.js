/**
 * LLM — prompt templates (the Prompt-Engineering layer)
 *
 * Two grounded prompts that reuse the ontology contract:
 *  1) answerSynthesisPrompt — RAG *generation*: turn the engine's evidence
 *     bundle into a grounded answer, with hard rules that forbid fabrication and
 *     force the model to respect supportStatus / missing slots.
 *  2) entityExtractionPrompt — ingestion: extract typed entities + relations
 *     from raw text, constrained to the ontology (structured JSON output).
 *
 * Prompts are deterministic functions of (question, bundle) / (text, contract)
 * so they are testable and versionable.
 */

import { OBJECT_TYPES } from "../types/objectTypes.js";
import { LINK_TYPES } from "../types/linkTypes.js";

const concreteTypes = () => Object.keys(OBJECT_TYPES).filter((t) => !OBJECT_TYPES[t].abstract);

/* ── 1) Grounded answer synthesis ── */
export function answerSynthesisPrompt(question, bundle) {
  const system = [
    "You are a financial market-intelligence analyst. You answer ONLY from the ontology evidence provided — never from prior knowledge.",
    "Hard rules:",
    `- The retrieval support status is "${bundle.supportStatus}". If it is "unsupported", reply that the knowledge graph does not support an answer, and stop.`,
    "- Use only the RELATED NODES and EVIDENCE below. Do not introduce entities or numbers that are not present.",
    bundle.missingSlots?.length ? `- These required pieces are MISSING from the graph — name them as gaps: ${bundle.missingSlots.join(", ")}.` : "- State your confidence plainly.",
    "- Cite supporting posts by their title in parentheses.",
    "- Be concise: 3–5 sentences. No preamble.",
  ].join("\n");

  const ctx = {
    question,
    intent: bundle.intent?.label,
    anchors: bundle.anchors?.map((a) => a.label),
    relatedNodes: bundle.relatedNodes?.map((n) => ({ label: n.label, type: n.type, relation: n.via })),
    impactPath: bundle.path?.map((s) => s.label),
    evidence: bundle.evidence?.map((e) => ({ title: e.title, snippet: e.snippet, subreddit: e.subreddit })),
    missingSlots: bundle.missingSlots,
    supportStatus: bundle.supportStatus,
  };
  const user = `Answer the question using only this grounded context:\n\n${JSON.stringify(ctx, null, 2)}`;
  return { system, user };
}

/* ── 2) Ontology-constrained entity/relation extraction ── */
export function entityExtractionPrompt(text) {
  const types = concreteTypes();
  const rels = Object.keys(LINK_TYPES);
  const system = [
    "You extract a typed knowledge graph from text, conforming to a fixed ontology.",
    `Allowed object types: ${types.join(", ")}.`,
    `Allowed relationship types: ${rels.join(", ")}.`,
    "Rules:",
    "- Only emit entities/relations explicitly supported by the text.",
    "- Each object: { id (snake_case), label, type (one of the allowed types), shortSummary }.",
    "- Each link: { source (id), target (id), type (one of the allowed relations), polarity? }.",
    "- Return STRICT JSON: { \"objects\": [...], \"links\": [...] }. No prose.",
  ].join("\n");
  const user = `TEXT:\n${text}`;
  return { system, user };
}

/** JSON schema for structured-output extraction (for tools that enforce schemas). */
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    objects: { type: "array", items: { type: "object",
      properties: { id: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: concreteTypes() }, shortSummary: { type: "string" } },
      required: ["id", "label", "type"] } },
    links: { type: "array", items: { type: "object",
      properties: { source: { type: "string" }, target: { type: "string" }, type: { type: "string", enum: Object.keys(LINK_TYPES) }, polarity: { type: "string", enum: ["positive", "negative"] } },
      required: ["source", "target", "type"] } },
  },
  required: ["objects", "links"],
};
