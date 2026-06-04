# graph-ingest — LangGraph ontology ingestion service

Turns raw text (Reddit posts / news) into **ontology-conformant instances** using
a LangGraph agent pipeline, governed by the *same* ontology contract as the JS
runtime (`ontology_contract.py` mirrors `src/ontology/types/*`).

## Pipeline (LangGraph)

```
START → extract → validate → ⟳(retry once) → link → emit → END
```

- **extract** — LLM (Bedrock or Anthropic) extracts typed entities/relations, constrained to the ontology (`prompts.py`).
- **validate** — drops anything violating the contract (unknown types, missing required props, dangling links).
- **link** — de-dups by id, stamps provenance (`__backingDataset`, `__sourceRefs`).
- **emit** — returns `{objects, links}` ready to load into the JS store / a graph DB.

Conditional edge re-runs extraction once if nothing valid survives — agentic self-repair.

## Run locally

```bash
cd services/graph-ingest
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...        # or AWS_REGION for Bedrock
python -m pipeline                  # runs the sample document
```

Output is the same instance shape the JS `createStore(dataset)` consumes — so an
ingested document flows straight into the GraphRAG engine.

## Deploy (AWS)

`lambda_handler.handler` is the Lambda entrypoint. Set `INSTANCES_BUCKET` to write
snapshots to S3; the frontend reads the snapshot (no server needed). See
[`docs/AWS_ARCHITECTURE.md`](../../docs/AWS_ARCHITECTURE.md).

## Why it matters (contract parity)

The Python service and the JS runtime validate against the *same* ontology. A fact
extracted here is guaranteed to fit the types the query engine reasons over — the
"one contract governs the whole loop" invariant, across two languages.
