# RedditPulse

**Real-time Reddit keyword network visualizer** — an interactive force-directed graph that maps trending topics, sentiment flows, and community dynamics across subreddits.

![Dark Mode](demo-dark.gif)

<details>
<summary>Light Mode</summary>

![Light Mode](demo-light.gif)

</details>

## Features

**Interactive Network Graph**
- D3.js force-directed graph with physics simulation (collision, charge, link forces)
- Drag, zoom, pan with smooth transitions
- Hover to highlight connected nodes and edges
- Click nodes to inspect detailed trend data
- Speech bubble animations on top trending keywords

**Multi-Chart Dashboard**
- Weekly trend line chart per keyword
- Sentiment distribution donut chart
- Top keywords horizontal bar chart
- Drama Detector panel for controversy spikes

**Theming**
- Dark / Light mode toggle with smooth CSS transitions
- Full color palette swap across all components (graph, charts, UI)

**Data Sources**
- Mock data engine with 5 subreddit presets (technology, worldnews, science, gaming, **finance**)
- Claude API integration ready for live Reddit analysis

**Ontology / GraphRAG** *(new)*
- Ontology schema of 10 entity types + 9 relationship types
- Finance/market intelligence preset with evidence-backed entities
- Evidence & lineage panel, GraphRAG-style question panel, and a Daily Social Signal Brief — all on mock data, no API key required

## Tech Stack

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-v7-F9A03C?logo=d3dotjs&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-4-FF6384?logo=chartdotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?logo=javascript&logoColor=black)

## Architecture

```text
redditpulse.jsx                  — root app (graph, charts, layout, theme)
├── ForceGraph                   — D3 force simulation + SVG, now type-aware
├── TrendChart / SentDonut / TopBar — Chart.js visualizations
└── App                          — layout, state, theme, ontology wiring

src/ontology/                    — ontology + GraphRAG layer (pure JS, no React)
├── schema.js                    — entity & relationship type definitions
├── mockOntologyData.js          — finance ontology + legacy-preset bridge
└── graphRagEngine.js            — deterministic answer / evidence / briefing

src/components/                  — ontology UI panels (React)
├── OntologyQueryPanel.jsx       — GraphRAG-style question panel
├── EvidencePanel.jsx            — evidence & lineage for a selected node
└── DailyBriefing.jsx            — Daily Social Signal Brief modal
```

## Quick Start

```bash
git clone https://github.com/somi/reddit-network-viz.git
cd reddit-network-viz
npm install
npm run dev
```

Open http://localhost:5173

No API key is required — the finance preset and every ontology feature run on built-in mock data.

## Ontology / GraphRAG Upgrade

RedditPulse is more than a keyword visualizer: discussions are modeled as an **ontology** — a typed graph of entities and the relationships between them — which makes the data *queryable* and *explainable* rather than just *pretty*.

### What the ontology layer does

Instead of generic keyword nodes, every node has an **entity type** and every edge has a **relationship type**, plus confidence and evidence metadata.

- **Entity types** (10): `Subreddit`, `Post`, `Topic`, `Organization`, `Product`, `Person`, `AssetOrTicker`, `Event`, `SentimentSignal`, `RiskSignal`
- **Relationship types** (9): `MENTIONS`, `DISCUSSED_IN`, `CO_OCCURS_WITH`, `RELATED_TO_EVENT`, `IMPACTS`, `ESCALATES`, `CONTRADICTS`, `TRENDING_WITH`, `EVIDENCED_BY`

The schema lives in [`src/ontology/schema.js`](src/ontology/schema.js). Node types are distinguished in the graph subtly — a type-colored accent rim, plus a dashed ring for `Event` / `RiskSignal` / `SentimentSignal` — without changing the existing visual identity. Each node carries `confidence`, `evidenceCount`, `shortSummary`, an optional `ticker`, and `sourceSubreddits`.

### Why this is more than keyword visualization

- **Typed & explainable** — you can ask "which *organizations* connect to AI datacenter discussions?" and the graph knows what an organization is.
- **Evidence & lineage** — clicking a node opens a lineage view: *why* it is trending, its top related nodes (with the relationship type), evidence count, sentiment/trend deltas, and example source snippets.
- **Decision intelligence** — the output is structured for action (briefings, risk signals), not just a chart.

### How the GraphRAG-style query panel works

The **🧠 Ask the ontology** panel answers predefined or free-typed questions:

- *Why is NVIDIA trending across finance and technology communities?*
- *Which topics are causing negative sentiment around Bitcoin?*
- *What market risks are emerging from Reddit discussions?*
- *Which companies are connected to AI datacenter discussions?*

Answers are produced by a **deterministic engine** ([`src/ontology/graphRagEngine.js`](src/ontology/graphRagEngine.js)) that walks the graph — no LLM/API key needed — and returns a short summary, related nodes, evidence snippets, a confidence score, and suggested follow-ups. The engine is intentionally shaped so the call site could later be swapped for an **LLM / MCP tool** returning the same JSON.

### Finance / market intelligence use case

The **r/finance** preset ships a hand-authored ontology spanning NVIDIA, OpenAI, Bitcoin, Ethereum, interest rates, inflation, earnings, AI datacenter, semiconductor, the Federal Reserve, recession risk, ETFs and more — wired with realistic `IMPACTS` / `ESCALATES` / `RELATED_TO_EVENT` links and backed by mock source posts. The **📋 Brief** button generates a *Daily Social Signal Brief*: top trending entity, biggest sentiment shift, emerging risk signal, communities involved, a 3–5 bullet briefing, and an evidence-backed note — aligned with market-intelligence and automated-briefing use cases.

### Future extension ideas

- **Reddit API ingestion** — replace mock data with live posts/comments
- **LLM-based entity extraction** — auto-build the ontology from raw text
- **MCP tools** — expose `answerQuestion` / `generateBriefing` as callable tools
- **Vector search** — semantic retrieval of evidence snippets
- **Neo4j / graph database** — persist the ontology for large-scale querying
- **Streaming market/news signals** — fuse Reddit sentiment with price/news feeds

## License

MIT
