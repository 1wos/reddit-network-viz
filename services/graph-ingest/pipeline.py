"""
LangGraph ingestion pipeline — agentic orchestration of:

   extract → validate → (retry?) → link → emit

Raw text (Reddit/news) becomes ontology-conformant instances ({objects, links})
ready to load into the JS store / a graph DB. Each node is a small, testable
unit; LangGraph wires the control flow (including a conditional retry on a failed
extraction), demonstrating agent-orchestration over a typed contract.
"""
from typing import Any, Dict, List, TypedDict

from langgraph.graph import StateGraph, START, END

from ontology_contract import validate_instances
from prompts import extraction_system, extraction_user
from llm import extract_json


class IngestState(TypedDict, total=False):
    text: str
    source: str          # provenance (e.g. "reddit:r/finance:<postid>")
    extraction: Dict[str, Any]
    instances: Dict[str, Any]
    errors: List[str]
    attempts: int


def node_extract(state: IngestState) -> IngestState:
    data = extract_json(extraction_system(), extraction_user(state["text"]))
    return {"extraction": data, "attempts": state.get("attempts", 0) + 1}


def node_validate(state: IngestState) -> IngestState:
    cleaned, errors = validate_instances(state.get("extraction", {}))
    return {"instances": cleaned, "errors": errors}


def route_after_validate(state: IngestState) -> str:
    # retry extraction once if nothing valid survived
    if not state["instances"]["objects"] and state.get("attempts", 0) < 2:
        return "extract"
    return "link"


def node_link(state: IngestState) -> IngestState:
    # de-dup objects by id, stamp provenance on every instance
    seen, objects = set(), []
    for o in state["instances"]["objects"]:
        key = o.get("id") or o.get("name")
        if key in seen:
            continue
        seen.add(key)
        o = {**o, "__backingDataset": "langgraph-ingest", "__sourceRefs": [state.get("source", "unknown")]}
        objects.append(o)
    return {"instances": {"objects": objects, "links": state["instances"]["links"]}}


def node_emit(state: IngestState) -> IngestState:
    return {"instances": state["instances"]}


def build_graph():
    g = StateGraph(IngestState)
    g.add_node("extract", node_extract)
    g.add_node("validate", node_validate)
    g.add_node("link", node_link)
    g.add_node("emit", node_emit)
    g.add_edge(START, "extract")
    g.add_edge("extract", "validate")
    g.add_conditional_edges("validate", route_after_validate, {"extract": "extract", "link": "link"})
    g.add_edge("link", "emit")
    g.add_edge("emit", END)
    return g.compile()


GRAPH = build_graph()


def run_ingest(text: str, source: str = "unknown") -> dict:
    """Run the full pipeline on one document; returns {instances, errors}."""
    out = GRAPH.invoke({"text": text, "source": source, "attempts": 0})
    return {"instances": out["instances"], "errors": out.get("errors", [])}


if __name__ == "__main__":  # local demo (requires an LLM key)
    import json
    sample = "NVIDIA depends on TSMC for advanced chips, and OpenAI's datacenter buildout is driving GPU demand. Rising interest rates pressure Bitcoin."
    print(json.dumps(run_ingest(sample, source="demo"), indent=2))
