"""Ontology-constrained extraction prompt (Python mirror of src/ontology/llm/prompts.js)."""

from ontology_contract import OBJECT_TYPES, LINK_TYPES


def extraction_system() -> str:
    return "\n".join([
        "You extract a typed knowledge graph from text, conforming to a fixed ontology.",
        f"Allowed object types: {', '.join(OBJECT_TYPES.keys())}.",
        f"Allowed relationship types: {', '.join(sorted(LINK_TYPES))}.",
        "Rules:",
        "- Only emit entities/relations explicitly supported by the text.",
        "- Each object: { id (snake_case), label, type (allowed), shortSummary }.",
        "- Each link: { source (id), target (id), type (allowed), polarity? }.",
        '- Return STRICT JSON: { "objects": [...], "links": [...] }. No prose.',
    ])


def extraction_user(text: str) -> str:
    return f"TEXT:\n{text}"
