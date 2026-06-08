/**
 * Ingest — Reddit Stock Sentiment → ontology dataset adapter
 *
 * Converts the open Reddit stock-sentiment dataset
 * (johntoro/Reddit-Stock-Sentiment, Artistic-2.0) into the store's
 * { objects, links } shape. Unlike the FiQA news data, this is real Reddit
 * social structure — multiple communities, authors, and free text — so the
 * adapter does light *entity extraction* ($cashtags + known tickers) the way the
 * LangGraph ingest pipeline would, rather than reading a pre-labeled target.
 *
 * Each row → a RedditPost (sentiment from TextBlob polarity), AUTHORED_BY an
 * Author, POSTED_IN a Subreddit, with MENTIONS(sentiment) + EVIDENCED_BY to any
 * tickers found in the text.
 */

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round2 = (x) => Math.round(x * 100) / 100;

const CRYPTO = new Set(["BTC", "ETH", "DOGE", "SHIB", "ADA", "SOL", "XRP"]);
const KNOWN = new Set([
  "AAPL", "TSLA", "GME", "AMC", "NVDA", "MSFT", "GOOG", "GOOGL", "AMZN", "META", "NFLX",
  "SPY", "QQQ", "PLTR", "AMD", "INTC", "NIO", "COIN", "HOOD", "SOFI", "BB", "NOK", "F",
  "BABA", "DIS", "BAC", "JPM", "T", "PYPL", "SQ", "UBER", "RIVN", "LCID", "MARA", "RIOT",
  ...CRYPTO,
]);

/** Pull tickers from text: $cashtags + bare mentions of known tickers. */
function extractTickers(text) {
  const out = new Set();
  const t = String(text || "");
  for (const m of t.matchAll(/\$([A-Za-z]{1,5})\b/g)) out.add(m[1].toUpperCase());
  for (const m of t.matchAll(/\b([A-Z]{2,5})\b/g)) if (KNOWN.has(m[1])) out.add(m[1]);
  return [...out];
}

export function buildRedditSentimentDataset(rows, opts = {}) {
  const TS = 0;
  const data = opts.limit ? rows.slice(0, opts.limit) : rows;
  const objects = [];
  const links = [];
  const subs = new Set();
  const authors = new Set();
  const tickers = new Map(); // id → { id, label, ticker, scores[] }

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  for (const r of data) {
    const pid = `rss-${r.post_id}`;
    const pol = clamp(num(r.polarity), -1, 1);
    const text = `${r.title || ""} ${r.text || ""}`.trim();

    objects.push({
      __type: "RedditPost", __backingDataset: "reddit-stock-sentiment", __sourceRefs: [String(r.post_id)], __ingestedAt: TS,
      id: pid, title: String(r.title || r.text || "(post)").slice(0, 140), body: String(r.text || ""),
      sentiment: round2(pol), score: Math.max(0, Math.round(num(r.upvotes))),
    });

    if (r.subreddit) {
      const sn = String(r.subreddit);
      subs.add(sn);
      links.push({ type: "POSTED_IN", source: pid, target: sn, props: {} });
    }
    const author = String(r.author || "").trim();
    if (author && author !== "None" && author !== "[deleted]") {
      authors.add(author);
      links.push({ type: "AUTHORED_BY", source: pid, target: author, props: {} });
    }
    for (const tk of extractTickers(text)) {
      const id = `tkr_${slug(tk)}`;
      if (!tickers.has(id)) tickers.set(id, { id, label: tk, ticker: tk, scores: [] });
      tickers.get(id).scores.push(pol);
      links.push({ type: "MENTIONS", source: pid, target: id, props: { sentiment: round2(pol), weight: 0.6 } });
      links.push({ type: "EVIDENCED_BY", source: id, target: pid, props: {} });
    }
  }

  for (const name of subs) objects.push({ __type: "Subreddit", __backingDataset: "reddit-stock-sentiment", __sourceRefs: [], __ingestedAt: TS, name });
  for (const username of authors) objects.push({ __type: "Author", __backingDataset: "reddit-stock-sentiment", __sourceRefs: [], __ingestedAt: TS, username });
  for (const t of tickers.values()) {
    const avg = t.scores.reduce((a, b) => a + b, 0) / t.scores.length;
    objects.push({
      __type: "AssetOrTicker", __backingDataset: "reddit-stock-sentiment", __sourceRefs: [], __ingestedAt: TS,
      id: t.id, label: t.label, ticker: t.ticker, assetClass: CRYPTO.has(t.ticker) ? "crypto" : "equity",
      frequency: t.scores.length, evidenceCount: t.scores.length, sentiment: round2(clamp(avg, -1, 1)), confidence: 0.7,
    });
  }

  return { objects, links };
}
