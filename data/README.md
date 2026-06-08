# data

Two open datasets that ingest into the same typed ontology, proving the GraphRAG
stack runs on real data — not only the hand-authored finance mock.

## `fiqa-sentiment.json` — financial news

FiQA aspect-based sentiment (`_id`, `sentence`, `target`, `aspect`, `score`, `type`;
1,173 rows). Clean entity + sentiment labels → posts, entities, topics.

- Source: [TheFinAI/fiqa-sentiment-classification](https://huggingface.co/datasets/TheFinAI/fiqa-sentiment-classification) · License: MIT
- Loader: [`src/ontology/ingest/fiqaDataset.js`](../src/ontology/ingest/fiqaDataset.js)

## `reddit-stock-sentiment.json` — Reddit social

Real Reddit posts/comments across r/stocks, r/StockMarket, r/wallstreetbets, … with
authors and TextBlob sentiment. No labeled entities — the loader does light
extraction ($cashtags + known tickers) like the ingest pipeline would.

- Source: [johntoro/Reddit-Stock-Sentiment](https://huggingface.co/datasets/johntoro/Reddit-Stock-Sentiment) · License: Artistic-2.0
- Loader: [`src/ontology/ingest/redditSentimentDataset.js`](../src/ontology/ingest/redditSentimentDataset.js)

Both are exercised by `npm run fiqa` (the real-data CI gate).
