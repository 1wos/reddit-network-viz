/**
 * LLM — prompt templates (Prompt-Engineering layer)
 *
 * Built on the official provider prompt guides, applied deliberately:
 *  - Anthropic: XML-tag structure (<role>/<rules>/<grounded_context>) — Claude is
 *    trained on XML and it yields more consistent output; + the metaprompt idea.
 *    https://platform.claude.com/docs/en/build-with-claude/prompt-engineering
 *    https://github.com/anthropics/anthropic-cookbook (misc/metaprompt.ipynb)
 *  - OpenAI: clear instructions, "use reference text" (ground from provided
 *    context), break tasks down, structured output.
 *    https://developers.openai.com/api/docs/guides/prompt-engineering
 *  - Google Gemini: JSON-schema structured output + put the MOST CRITICAL
 *    constraint LAST. https://ai.google.dev/gemini-api/docs/prompting-strategies
 *
 * Prompts are deterministic functions → testable & versionable.
 */

import { OBJECT_TYPES } from "../types/objectTypes.js";
import { LINK_TYPES } from "../types/linkTypes.js";

const concreteTypes = () => Object.keys(OBJECT_TYPES).filter((t) => !OBJECT_TYPES[t].abstract);

/** Provenance: which technique came from which provider guide (for transparency/docs). */
export const PROMPT_TECHNIQUES = [
  { technique: "XML-tag sectioning", source: "Anthropic" },
  { technique: "ground strictly from provided reference context", source: "OpenAI" },
  { technique: "few-shot example", source: "OpenAI/Anthropic" },
  { technique: "JSON-schema structured output", source: "Google Gemini / OpenAI" },
  { technique: "most-critical constraint placed last", source: "Google Gemini" },
  { technique: "metaprompt (generate a prompt from a task)", source: "Anthropic cookbook" },
];

/* ── 1) Grounded answer synthesis (RAG generation) ── */
export function answerSynthesisPrompt(question, bundle) {
  const system = [
    "<role>",
    "You are a financial market-intelligence analyst. Answer ONLY from the ontology evidence provided — never from prior knowledge or training data.",
    "</role>",
    "",
    "<rules>",
    "- Use only the entities and posts inside <grounded_context>. Do not introduce any entity, number, or claim not present there.",
    "- Cite supporting posts by their title in parentheses.",
    bundle.missingSlots?.length
      ? `- These required pieces are MISSING from the graph — name them as coverage gaps: ${bundle.missingSlots.join(", ")}.`
      : "- State your confidence plainly at the end.",
    "- Be concise: 3–5 sentences, no preamble.",
    "</rules>",
    "",
    // Gemini guidance: most-critical constraint LAST.
    "<critical>",
    `The retrieval support_status is "${bundle.supportStatus}". If it is "unsupported", reply that the knowledge graph does not support an answer, and stop. Never fabricate to fill a gap.`,
    "</critical>",
  ].join("\n");

  const ctx = {
    intent: bundle.intent?.label,
    anchors: bundle.anchors?.map((a) => a.label),
    relatedNodes: bundle.relatedNodes?.map((n) => ({ label: n.label, type: n.type, relation: n.via })),
    impactPath: bundle.path?.map((s) => s.label),
    evidence: bundle.evidence?.map((e) => ({ title: e.title, snippet: e.snippet, subreddit: e.subreddit })),
    missingSlots: bundle.missingSlots,
    supportStatus: bundle.supportStatus,
  };
  const user = `<grounded_context>\n${JSON.stringify(ctx, null, 2)}\n</grounded_context>\n\n<question>${question}</question>`;
  return { system, user };
}

/* ── 2) Ontology-constrained entity/relation extraction (structured output) ── */
export function entityExtractionPrompt(text) {
  const types = concreteTypes();
  const rels = Object.keys(LINK_TYPES);
  const system = [
    "<task>Extract a typed knowledge graph from the text, conforming to a fixed ontology.</task>",
    "",
    "<ontology>",
    `  <object_types>${types.join(", ")}</object_types>`,
    `  <relationship_types>${rels.join(", ")}</relationship_types>`,
    "</ontology>",
    "",
    "<example>",
    "  <input>NVIDIA relies on TSMC for advanced chips.</input>",
    '  <output>{"objects":[{"id":"nvidia","label":"NVIDIA","type":"Organization"},{"id":"tsmc","label":"TSMC","type":"Organization"}],"links":[{"source":"tsmc","target":"nvidia","type":"IMPACTS","polarity":"positive"}]}</output>',
    "</example>",
    "",
    "<rules>",
    "- Only emit entities/relations explicitly supported by the text.",
    "- object: { id (snake_case), label, type (must be an allowed object type), shortSummary }",
    "- link: { source (id), target (id), type (must be an allowed relationship type), polarity? }",
    '- Return STRICT JSON only: { "objects": [...], "links": [...] }. No prose, no markdown.',
    "</rules>",
  ].join("\n");
  return { system, user: `<text>\n${text}\n</text>` };
}

/* ── 3) Metaprompt (Anthropic cookbook) — generate a task prompt from a description ── */
export function metaPrompt(taskDescription, variables = []) {
  const vars = variables.length ? variables.map((v) => `{{${v.toUpperCase()}}}`).join(", ") : "(none)";
  const system = [
    "<role>You are a prompt engineer. Write a high-quality prompt for the task below.</role>",
    "<guidelines>",
    "- Structure the prompt with XML tags (<task>, <context>, <instructions>, <output_format>).",
    "- Demarcate input variables with double curly braces so they are unambiguous.",
    "- Put the single most critical constraint last.",
    "- Output ONLY the prompt text.",
    "</guidelines>",
  ].join("\n");
  const user = `<task_description>${taskDescription}</task_description>\n<variables>${vars}</variables>`;
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
