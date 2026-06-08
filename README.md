# RedditPulse — Ontology GraphRAG

**Models social-finance discussion as a typed ontology, then answers questions over it with grounded, guardrailed retrieval.**

![architecture](https://img.shields.io/badge/architecture-neurosymbolic-6E56CF?style=flat-square)
![ci](https://img.shields.io/badge/CI-9%20gates-3FB950?style=flat-square)
![grounded](https://img.shields.io/badge/no--fabrication-100%25-3FB950?style=flat-square)
![iac](https://img.shields.io/badge/IaC-AWS%20·%20GCP%20·%20Azure-FF9900?style=flat-square)

![demo](demo-dark.gif)

<details>
<summary>Light mode</summary>

![light](demo-light.gif)

</details>

RedditPulse turns noisy social-finance chatter into a *queryable, explainable* knowledge layer. Discussions are modeled as a Palantir-style **typed ontology** — objects, relationships, actions, and lineage — so the system reasons over *what an entity is* and *why it matters*, not just keyword co-occurrence. Every answer is grounded in graph evidence and checked by a rule engine before it is surfaced.

* * *

## How it works

A question flows through one grounded pipeline:

```text
intent → subgraph → evidence → guard → answer
```

The retrieval layer (**GraphRAG**) resolves the question to ontology anchors, expands the typed subgraph, reranks the evidence, and refuses to answer beyond what the graph supports. A **Symbolic Guard** then checks each candidate against declarative rules and returns `valid / invalid / needs_review` — *neural proposes, symbolic verifies*. Only evidence-backed candidates are surfaced as actionable.

* * *

## Key Features

**Typed Ontology** — 10 entity types and 9 relationship types with confidence, lineage, and a kinetic action layer (TBox/ABox shared across the JS runtime and the Python ingest service). Runs on a hand-authored finance preset *and* on real data — two open datasets (**FiQA** financial news and a **Reddit** stock-sentiment set) ingest into the same ontology with extracted entities, authors, and tickers (lint-clean).

**Grounded GraphRAG** — intent-driven retrieval with explicit support status; when the graph cannot answer, it says so instead of fabricating.

**Symbolic Guard** — a System-2 rule engine that validates LLM/GraphRAG candidates and returns the rules fired plus the graph path that justifies each verdict.

**Multi-Provider Retrieval** — KG-RAG vector reranking and real embeddings behind one abstraction (Cohere, Upstage Solar, Gemini, OpenAI), with a deterministic offline baseline.

**Operational Platform** — FastAPI + Redis queue + Node worker + Go exporter, OpenTelemetry tracing, Helm/ArgoCD, deployed on Kubernetes (kind).

**Multi-Cloud IaC** — the ingest stack as Terraform for AWS, GCP, and Azure.

* * *

## Results

| Metric | Result |
| --- | --- |
| Citation faithfulness / no-fabrication | **98.8% / 100%** |
| Paraphrase recall@3 (hashing → real embeddings) | **66.7% → 100%** |
| Embedding latency at equal recall (Upstage vs Gemini) | **87ms vs 523ms** |
| LLM providers verified live on the same grounded bundle | **4** (Claude · Solar · Grok · GPT) |
| Terraform validated / plan-verified on live accounts | **3 clouds / GCP + Azure** |
| CI quality gates | **9 passing** |

* * *

## Tech Stack

![stack](https://skillicons.dev/icons?i=react,nodejs,python,fastapi,go,redis,docker,kubernetes,prometheus,grafana,terraform,githubactions)

![D3.js](https://img.shields.io/badge/D3.js-F9A03C?logo=d3dotjs&logoColor=white)
![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-425CC7?logo=opentelemetry&logoColor=white)
![Helm](https://img.shields.io/badge/Helm-0F1689?logo=helm&logoColor=white)
![ArgoCD](https://img.shields.io/badge/Argo%20CD-EF7B4D?logo=argo&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C)
![MCP](https://img.shields.io/badge/MCP-000000)
![Cohere](https://img.shields.io/badge/Cohere-39594B)
![Upstage](https://img.shields.io/badge/Upstage%20Solar-7C3AED)

* * *

## Related

Parts of the ontology and grounded-GraphRAG design build on my work on the open-source **seocho** GraphRAG project — [github.com/1wos/seocho](https://github.com/1wos/seocho).
