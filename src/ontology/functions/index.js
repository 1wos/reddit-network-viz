/**
 * Ontology — Functions (derived logic per object type)
 *
 * Pure, deterministic computations over an object + the store. These are the
 * "Functions on Objects" layer: the UI and Actions call them instead of
 * re-deriving values ad hoc. All return plain numbers/objects.
 */

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Trend momentum: last − first of the 7-day trend. */
export function momentum(entity) {
  const t = entity?.trend || [];
  return t.length >= 2 ? t[t.length - 1] - t[0] : 0;
}

/** Aggregate sentiment from incoming MENTIONS links, else the stored value. */
export function sentimentScore(entity, store) {
  const ms = store.getLinks({ type: "MENTIONS", target: entity.id })
    .map((l) => l.props?.sentiment).filter((v) => typeof v === "number");
  return ms.length ? Math.round(avg(ms) * 100) / 100 : (entity.sentiment ?? 0);
}

/** Topic heat: normalized recent velocity of the trend. */
export function heat(topic) {
  const t = topic?.trend || [];
  if (t.length < 2) return 0;
  const m = momentum(topic);
  const peak = Math.max(...t, 1);
  return clamp01((m / peak + 1) / 2);
}

/** Risk score [0,1] for an asset: bearish sentiment + impacting risk signals + volatility. */
export function riskScore(asset, store) {
  const base = (1 - (asset.sentiment ?? 0)) / 2; // [0,1], higher when bearish
  const riskNeighbors = store.neighbors(asset.id).filter((n) => n.node.__type === "RiskSignal");
  const riskPush = avg(riskNeighbors.map((n) => n.node.magnitude ?? 0.5));
  const vol = clamp01((asset.volatility ?? 0) / 100);
  return Math.round(clamp01(0.5 * base + 0.35 * riskPush + 0.15 * vol) * 100) / 100;
}

/** Recompute a signal's confidence from how much evidence backs it. */
export function recomputeConfidence(signal, store) {
  const evidence = store.getLinks({ type: "EVIDENCED_BY", source: signal.id }).length || signal.evidenceCount || 0;
  return Math.round(clamp01(0.4 + evidence * 0.04) * 100) / 100;
}

/** Average sentiment of posts in a subreddit. */
export function communitySentiment(subreddit, store) {
  const postIds = store.getLinks({ type: "POSTED_IN", target: subreddit.name }).map((l) => l.source);
  const sents = postIds.map((id) => store.get(id)?.sentiment).filter((v) => typeof v === "number");
  return sents.length ? Math.round(avg(sents) * 100) / 100 : (subreddit.communitySentiment ?? 0);
}

/* Registry: object type → { functionName: fn(obj, store) }. */
export const FUNCTIONS = {
  Organization: { momentum, sentimentScore },
  Product: { momentum, sentimentScore },
  Person: { momentum, sentimentScore },
  AssetOrTicker: { momentum, sentimentScore, riskScore },
  Topic: { momentum, sentimentScore, heat },
  Subreddit: { communitySentiment },
  SentimentSignal: { recomputeConfidence },
  RiskSignal: { recomputeConfidence },
};

/** Run a named function for an object via the registry. */
export function runFunction(obj, fnName, store) {
  const fn = FUNCTIONS[obj.__type]?.[fnName];
  if (!fn) throw new Error(`no function ${fnName} on ${obj.__type}`);
  return fn(obj, store);
}
