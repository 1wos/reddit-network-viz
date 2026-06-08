# data

`fiqa-sentiment.json` — the **FiQA** aspect-based financial sentiment dataset
(`_id`, `sentence`, `target`, `aspect`, `score`, `type`; 1,173 rows across
train/valid/test).

- Source: [TheFinAI/fiqa-sentiment-classification](https://huggingface.co/datasets/TheFinAI/fiqa-sentiment-classification)
- License: MIT

[`src/ontology/ingest/fiqaDataset.js`](../src/ontology/ingest/fiqaDataset.js) turns
these rows into a typed ontology (posts → entities → topics, wired with
MENTIONS/EVIDENCED_BY), proving the GraphRAG stack runs on real data, not only the
hand-authored finance mock. See `npm run fiqa`.
