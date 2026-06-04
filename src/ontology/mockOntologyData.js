/**
 * RedditPulse Ontology — Mock Data (US finance, densely modeled)
 *
 * A principled finance/market ontology: semiconductor supply chain, AI capex
 * super-cycle, macro rate transmission, crypto liquidity sensitivity, and risk
 * escalation — modeled as typed entities + typed, weighted relationships with
 * link properties (polarity / strength). Plus `enrichLegacy` to lift the
 * original keyword presets into the same ontology contract.
 *
 * Node:  { id, label, type, frequency, sentiment, trend[7], confidence,
 *          evidenceCount, shortSummary, ticker?, sourceSubreddits[], logo? }
 * Edge:  { source, target, type, weight, confidence, evidenceCount, polarity? }
 */

const favicon = (d) => `https://www.google.com/s2/favicons?domain=${d}&sz=128`;

/* Deterministic 7-day trend generator (seeded by id → reproducible). */
function seedOf(id) { let h = 2166136261; for (const ch of id) h = (h * 16777619) ^ ch.charCodeAt(0); return h >>> 0; }
function genTrend(base, slope, id) {
  const s = seedOf(id);
  return Array.from({ length: 7 }, (_, i) => Math.max(1, Math.round(base + slope * i + (((s >> (i * 3)) & 7) - 3))));
}

/* Node builder. p = { f:frequency, s:sentiment, c:confidence, e:evidenceCount,
   base, slope, sum, subs, x:{type-specific extras} } */
const FIN = ["finance"];
function N(id, label, type, p) {
  return {
    id, label, type,
    frequency: p.f, sentiment: p.s, confidence: p.c, evidenceCount: p.e,
    trend: genTrend(p.base ?? Math.round(p.f / 8), p.slope ?? 3, id),
    shortSummary: p.sum, sourceSubreddits: p.subs ?? FIN,
    ...(p.x || {}),
  };
}

const FT = ["finance", "technology"];
const FW = ["finance", "worldnews"];

/* ─── Nodes (~47) ─── */
const FINANCE_NODES = [
  /* Organizations */
  N("nvidia", "NVIDIA", "Organization", { f: 340, s: 0.6, c: 0.92, e: 42, slope: 11, sum: "AI-chip bellwether; index-level concentration risk.", subs: FT, x: { ticker: "NVDA", logo: favicon("nvidia.com") } }),
  N("openai", "OpenAI", "Organization", { f: 268, s: 0.42, c: 0.85, e: 31, slope: 8, sum: "Frontier-AI lab; datacenter buildout drives chip/power demand.", subs: FT, x: { logo: favicon("openai.com") } }),
  N("microsoft", "Microsoft", "Organization", { f: 212, s: 0.38, c: 0.83, e: 26, slope: 5, sum: "OpenAI backer; Azure AI capex anchor.", subs: FT, x: { ticker: "MSFT", logo: favicon("microsoft.com") } }),
  N("amd", "AMD", "Organization", { f: 176, s: 0.3, c: 0.78, e: 21, slope: 6, sum: "Challenger accelerator; MI-series vs NVIDIA.", subs: FT, x: { ticker: "AMD", logo: favicon("amd.com") } }),
  N("tsmc", "TSMC", "Organization", { f: 168, s: 0.34, c: 0.82, e: 22, slope: 5, sum: "Sole leading-edge foundry; chokepoint of the AI supply chain.", subs: FT, x: { ticker: "TSM", logo: favicon("tsmc.com") } }),
  N("meta", "Meta", "Organization", { f: 154, s: 0.26, c: 0.77, e: 18, slope: 4, sum: "Hyperscaler capex; open-weight model push.", subs: FT, x: { ticker: "META", logo: favicon("meta.com") } }),
  N("federal_reserve", "Federal Reserve", "Organization", { f: 256, s: -0.14, c: 0.91, e: 37, slope: 7, sum: "Sets policy rates; every dot-plot moves risk assets.", subs: FW, x: { logo: favicon("federalreserve.gov") } }),
  N("microstrategy", "MicroStrategy", "Organization", { f: 132, s: 0.12, c: 0.71, e: 15, slope: 6, sum: "Leveraged BTC treasury proxy.", x: { ticker: "MSTR", logo: favicon("microstrategy.com") } }),
  N("coinbase", "Coinbase", "Organization", { f: 124, s: 0.08, c: 0.7, e: 14, slope: 3, sum: "Largest US crypto exchange; regulatory bellwether.", x: { ticker: "COIN", logo: favicon("coinbase.com") } }),

  /* Assets */
  N("bitcoin", "Bitcoin", "AssetOrTicker", { f: 288, s: 0.16, c: 0.79, e: 34, slope: -2, sum: "Macro-sensitive crypto; reacts to liquidity & rates.", x: { ticker: "BTC", logo: favicon("bitcoin.org") } }),
  N("ethereum", "Ethereum", "AssetOrTicker", { f: 192, s: 0.2, c: 0.73, e: 22, slope: -1, sum: "No.2 crypto; ETF flows tracked with BTC.", x: { ticker: "ETH", logo: favicon("ethereum.org") } }),
  N("gold", "Gold", "AssetOrTicker", { f: 146, s: 0.3, c: 0.76, e: 17, slope: 5, sum: "Real-rate & dollar sensitive; risk-off hedge.", x: { ticker: "XAU" } }),
  N("crude_oil", "Crude Oil", "AssetOrTicker", { f: 138, s: -0.1, c: 0.72, e: 16, slope: 2, sum: "Inflation input; geopolitical premium.", subs: FW, x: { ticker: "CL" } }),

  /* Products */
  N("chatgpt", "ChatGPT", "Product", { f: 164, s: 0.46, c: 0.8, e: 21, slope: 5, sum: "Flagship product underpinning OpenAI compute demand.", subs: FT, x: { logo: favicon("openai.com") } }),
  N("h100_gpu", "H100 GPU", "Product", { f: 142, s: 0.5, c: 0.79, e: 18, slope: 4, sum: "Datacenter accelerator; allocation = AI-demand proxy.", subs: FT }),
  N("blackwell_gpu", "Blackwell GPU", "Product", { f: 158, s: 0.54, c: 0.78, e: 19, slope: 9, sum: "Next-gen NVIDIA platform; ramp drives revenue narrative.", subs: FT }),
  N("cuda", "CUDA", "Product", { f: 96, s: 0.4, c: 0.74, e: 11, slope: 2, sum: "Software moat locking in NVIDIA accelerators.", subs: FT }),
  N("spot_btc_etf", "Spot BTC ETF", "Product", { f: 172, s: 0.32, c: 0.78, e: 23, slope: 7, sum: "Channels retail/institutional flow into Bitcoin.", x: {} }),

  /* Persons */
  N("jerome_powell", "Jerome Powell", "Person", { f: 134, s: -0.18, c: 0.8, e: 19, slope: 6, sum: "Fed Chair; press-conference tone moves cut odds.", subs: FW }),
  N("sam_altman", "Sam Altman", "Person", { f: 138, s: 0.36, c: 0.77, e: 19, slope: 5, sum: "OpenAI CEO; compute/funding comments move chips.", subs: FT }),
  N("jensen_huang", "Jensen Huang", "Person", { f: 126, s: 0.48, c: 0.79, e: 17, slope: 6, sum: "NVIDIA CEO; demand commentary sets the tape.", subs: FT }),
  N("janet_yellen", "Janet Yellen", "Person", { f: 88, s: -0.08, c: 0.72, e: 11, slope: 2, sum: "Treasury Sec; issuance & debt path.", subs: FW }),
  N("michael_saylor", "Michael Saylor", "Person", { f: 92, s: 0.18, c: 0.68, e: 12, slope: 4, sum: "MicroStrategy chair; perpetual BTC bid narrative.", x: {} }),

  /* Topics */
  N("interest_rates", "Interest Rates", "Topic", { f: 244, s: -0.24, c: 0.88, e: 33, slope: 6, sum: "Dominant macro variable; the rate-path trade.", subs: FW, x: { category: "macro" } }),
  N("inflation", "Inflation", "Topic", { f: 214, s: -0.36, c: 0.84, e: 28, slope: -4, sum: "Cooling but sticky; frames every Fed thread.", subs: FW, x: { category: "macro" } }),
  N("treasury_yields", "Treasury Yields", "Topic", { f: 178, s: -0.2, c: 0.81, e: 22, slope: 5, sum: "Discount rate for everything; 10Y is the anchor.", subs: FW, x: { category: "macro" } }),
  N("dollar_strength", "Dollar Strength", "Topic", { f: 142, s: -0.16, c: 0.76, e: 16, slope: 4, sum: "DXY; headwind for gold, crypto, EM.", subs: FW, x: { category: "macro" } }),
  N("liquidity", "Liquidity", "Topic", { f: 162, s: 0.04, c: 0.78, e: 19, slope: 3, sum: "Net liquidity drives risk-asset beta.", x: { category: "macro" } }),
  N("earnings", "Earnings", "Topic", { f: 202, s: 0.32, c: 0.8, e: 25, slope: 8, sum: "Mega-cap beats lifting index sentiment.", x: { category: "markets" } }),
  N("ai_datacenter", "AI Datacenter", "Topic", { f: 236, s: 0.34, c: 0.87, e: 32, slope: 12, sum: "Capex super-cycle linking AI, chips, power, REITs.", subs: FT, x: { category: "ai" } }),
  N("semiconductor", "Semiconductor", "Topic", { f: 224, s: 0.28, c: 0.83, e: 28, slope: 7, sum: "Chip cycle; export controls vs AI demand.", subs: FT, x: { category: "markets" } }),
  N("export_controls", "Export Controls", "Topic", { f: 128, s: -0.4, c: 0.75, e: 15, slope: 4, sum: "China chip restrictions; revenue & geopolitical risk.", subs: FW, x: { category: "policy" } }),
  N("power_demand", "Power Demand", "Topic", { f: 144, s: 0.22, c: 0.76, e: 17, slope: 9, sum: "Datacenter electricity crunch; utilities & nuclear bid.", subs: FT, x: { category: "markets" } }),
  N("capex", "AI Capex", "Topic", { f: 188, s: 0.18, c: 0.8, e: 23, slope: 10, sum: "Hyperscaler spend; the number that must be paid back.", subs: FT, x: { category: "markets" } }),

  /* Events */
  N("fomc_decision", "FOMC Decision", "Event", { f: 198, s: -0.08, c: 0.88, e: 29, slope: 14, sum: "The meeting the whole sub positions into.", subs: FW }),
  N("nvda_earnings", "NVDA Earnings", "Event", { f: 184, s: 0.44, c: 0.86, e: 26, slope: 13, sum: "Quarterly print treated as a market-wide risk event.", subs: FT }),
  N("cpi_release", "CPI Release", "Event", { f: 156, s: -0.12, c: 0.83, e: 20, slope: 11, sum: "Inflation print that repriced cut odds.", subs: FW }),
  N("etf_approval", "ETF Approval", "Event", { f: 118, s: 0.4, c: 0.79, e: 14, slope: 6, sum: "Regulatory green-light that unlocked spot flows.", x: {} }),

  /* Risk signals */
  N("recession_risk", "Recession Risk", "RiskSignal", { f: 172, s: -0.62, c: 0.69, e: 20, slope: 8, sum: "Soft- vs hard-landing; rises with higher-for-longer.", subs: FW }),
  N("ai_bubble_risk", "AI Bubble Risk", "RiskSignal", { f: 158, s: -0.55, c: 0.66, e: 18, slope: 10, sum: "Concentration & circular-financing worry on AI capex.", subs: FT }),
  N("liquidity_risk", "Liquidity Risk", "RiskSignal", { f: 116, s: -0.5, c: 0.63, e: 13, slope: 6, sum: "Funding stress as QT drains reserves.", x: {} }),
  N("credit_risk", "Credit Risk", "RiskSignal", { f: 108, s: -0.48, c: 0.62, e: 12, slope: 5, sum: "Spreads & refinancing wall under higher rates.", subs: FW }),
  N("geopolitical_risk", "Geopolitical Risk", "RiskSignal", { f: 134, s: -0.52, c: 0.65, e: 15, slope: 5, sum: "Taiwan/China chip chokepoint & sanctions.", subs: FW }),

  /* Sentiment signals */
  N("rate_cut_optimism", "Rate-Cut Optimism", "SentimentSignal", { f: 166, s: 0.52, c: 0.71, e: 21, slope: 7, sum: "Easing hopes buoy equities & crypto on soft data.", x: {} }),
  N("crypto_fear", "Crypto Fear", "SentimentSignal", { f: 142, s: -0.48, c: 0.66, e: 16, slope: 2, sum: "Fear-and-greed swings amplify BTC/ETH drawdowns.", x: {} }),
  N("ai_euphoria", "AI Euphoria", "SentimentSignal", { f: 178, s: 0.58, c: 0.7, e: 22, slope: 9, sum: "Momentum chase around anything AI-adjacent.", subs: FT }),
  N("risk_off", "Risk-Off", "SentimentSignal", { f: 138, s: -0.5, c: 0.68, e: 16, slope: 4, sum: "De-grossing into the dollar and gold.", subs: FW }),
];

/* ─── Edges (~75) — E(source, target, type, weight, polarity?) ─── */
const E = (source, target, type, weight, pol) => ({
  source, target, type, weight,
  confidence: Math.round((0.6 + weight * 0.35) * 100) / 100,
  evidenceCount: Math.max(3, Math.round(weight * 22)),
  ...(pol ? { polarity: pol } : {}),
});

const FINANCE_EDGES = [
  /* Semiconductor supply chain + AI capex */
  E("tsmc", "nvidia", "IMPACTS", 0.9, "positive"),
  E("tsmc", "amd", "IMPACTS", 0.8, "positive"),
  E("nvidia", "semiconductor", "IMPACTS", 0.9, "positive"),
  E("amd", "semiconductor", "IMPACTS", 0.7, "positive"),
  E("nvidia", "amd", "TRENDING_WITH", 0.7),
  E("nvidia", "ai_datacenter", "CO_OCCURS_WITH", 0.88),
  E("ai_datacenter", "semiconductor", "IMPACTS", 0.85, "positive"),
  E("h100_gpu", "nvidia", "CO_OCCURS_WITH", 0.8),
  E("blackwell_gpu", "nvidia", "CO_OCCURS_WITH", 0.85),
  E("cuda", "nvidia", "CO_OCCURS_WITH", 0.7),
  E("h100_gpu", "ai_datacenter", "IMPACTS", 0.75, "positive"),
  E("blackwell_gpu", "ai_datacenter", "IMPACTS", 0.8, "positive"),
  E("openai", "ai_datacenter", "IMPACTS", 0.88, "positive"),
  E("openai", "chatgpt", "CO_OCCURS_WITH", 0.75),
  E("chatgpt", "ai_datacenter", "CO_OCCURS_WITH", 0.6),
  E("microsoft", "openai", "CO_OCCURS_WITH", 0.82),
  E("microsoft", "ai_datacenter", "IMPACTS", 0.7, "positive"),
  E("microsoft", "capex", "IMPACTS", 0.72, "positive"),
  E("meta", "capex", "IMPACTS", 0.68, "positive"),
  E("meta", "ai_datacenter", "IMPACTS", 0.6, "positive"),
  E("sam_altman", "openai", "CO_OCCURS_WITH", 0.78),
  E("jensen_huang", "nvidia", "CO_OCCURS_WITH", 0.8),
  E("ai_datacenter", "power_demand", "IMPACTS", 0.8, "positive"),
  E("power_demand", "capex", "IMPACTS", 0.62, "positive"),
  E("capex", "earnings", "IMPACTS", 0.6, "positive"),
  E("capex", "ai_bubble_risk", "ESCALATES", 0.72),
  E("ai_datacenter", "ai_bubble_risk", "ESCALATES", 0.7),
  E("ai_bubble_risk", "recession_risk", "ESCALATES", 0.58),
  E("ai_euphoria", "nvidia", "TRENDING_WITH", 0.8),
  E("ai_euphoria", "ai_bubble_risk", "CONTRADICTS", 0.6),
  E("ai_euphoria", "capex", "TRENDING_WITH", 0.6),

  /* Export controls / geopolitics */
  E("export_controls", "semiconductor", "IMPACTS", 0.78, "negative"),
  E("export_controls", "nvidia", "IMPACTS", 0.7, "negative"),
  E("export_controls", "geopolitical_risk", "ESCALATES", 0.7),
  E("geopolitical_risk", "tsmc", "IMPACTS", 0.65, "negative"),
  E("geopolitical_risk", "crude_oil", "IMPACTS", 0.5, "positive"),

  /* Macro rate transmission */
  E("federal_reserve", "interest_rates", "IMPACTS", 0.95, "positive"),
  E("federal_reserve", "fomc_decision", "RELATED_TO_EVENT", 0.95),
  E("jerome_powell", "federal_reserve", "CO_OCCURS_WITH", 0.82),
  E("jerome_powell", "fomc_decision", "RELATED_TO_EVENT", 0.78),
  E("interest_rates", "inflation", "IMPACTS", 0.85, "negative"),
  E("inflation", "interest_rates", "IMPACTS", 0.8, "positive"),
  E("interest_rates", "treasury_yields", "IMPACTS", 0.86, "positive"),
  E("interest_rates", "recession_risk", "IMPACTS", 0.8, "positive"),
  E("interest_rates", "liquidity", "IMPACTS", 0.72, "negative"),
  E("interest_rates", "bitcoin", "IMPACTS", 0.7, "negative"),
  E("interest_rates", "dollar_strength", "IMPACTS", 0.7, "positive"),
  E("inflation", "cpi_release", "RELATED_TO_EVENT", 0.8),
  E("cpi_release", "rate_cut_optimism", "IMPACTS", 0.7, "positive"),
  E("treasury_yields", "gold", "IMPACTS", 0.66, "negative"),
  E("treasury_yields", "bitcoin", "IMPACTS", 0.6, "negative"),
  E("treasury_yields", "dollar_strength", "TRENDING_WITH", 0.6),
  E("dollar_strength", "gold", "IMPACTS", 0.62, "negative"),
  E("dollar_strength", "bitcoin", "IMPACTS", 0.58, "negative"),
  E("liquidity", "bitcoin", "IMPACTS", 0.7, "positive"),
  E("liquidity", "ai_euphoria", "IMPACTS", 0.6, "positive"),
  E("liquidity", "liquidity_risk", "ESCALATES", 0.64),
  E("fomc_decision", "rate_cut_optimism", "IMPACTS", 0.72, "positive"),
  E("rate_cut_optimism", "recession_risk", "CONTRADICTS", 0.55),
  E("rate_cut_optimism", "spot_btc_etf", "TRENDING_WITH", 0.6),
  E("janet_yellen", "treasury_yields", "IMPACTS", 0.55, "positive"),
  E("recession_risk", "earnings", "IMPACTS", 0.6, "negative"),
  E("recession_risk", "credit_risk", "ESCALATES", 0.62),
  E("credit_risk", "liquidity_risk", "ESCALATES", 0.55),
  E("risk_off", "gold", "TRENDING_WITH", 0.66),
  E("risk_off", "ai_euphoria", "CONTRADICTS", 0.6),
  E("risk_off", "crypto_fear", "TRENDING_WITH", 0.58),

  /* Crypto */
  E("bitcoin", "ethereum", "CO_OCCURS_WITH", 0.85),
  E("bitcoin", "crypto_fear", "TRENDING_WITH", 0.72),
  E("bitcoin", "spot_btc_etf", "CO_OCCURS_WITH", 0.78),
  E("ethereum", "spot_btc_etf", "CO_OCCURS_WITH", 0.6),
  E("microstrategy", "bitcoin", "IMPACTS", 0.62, "positive"),
  E("michael_saylor", "microstrategy", "CO_OCCURS_WITH", 0.75),
  E("coinbase", "bitcoin", "CO_OCCURS_WITH", 0.6),
  E("coinbase", "spot_btc_etf", "CO_OCCURS_WITH", 0.55),
  E("spot_btc_etf", "etf_approval", "RELATED_TO_EVENT", 0.8),
  E("etf_approval", "bitcoin", "IMPACTS", 0.7, "positive"),
  E("crypto_fear", "rate_cut_optimism", "CONTRADICTS", 0.5),

  /* Earnings */
  E("earnings", "nvda_earnings", "RELATED_TO_EVENT", 0.78),
  E("nvidia", "nvda_earnings", "RELATED_TO_EVENT", 0.95),
  E("earnings", "nvidia", "IMPACTS", 0.65, "positive"),
  E("nvda_earnings", "ai_euphoria", "IMPACTS", 0.66, "positive"),
];

/* ─── Evidence posts ─── */
const FINANCE_POSTS = [
  { id: "p1", subreddit: "finance", title: "NVDA is now ~7% of the S&P — too concentrated?", snippet: "The whole rally is one chip stock. If NVDA earnings disappoint, the AI datacenter trade unwinds fast.", sentiment: -0.2, score: 4120, mentions: ["nvidia", "earnings", "ai_datacenter", "ai_bubble_risk", "nvda_earnings"] },
  { id: "p2", subreddit: "technology", title: "OpenAI's datacenter commitments imply staggering GPU demand", snippet: "If half of OpenAI's compute lands, NVIDIA, TSMC and the whole semiconductor chain are sold out for years.", sentiment: 0.5, score: 3380, mentions: ["openai", "ai_datacenter", "nvidia", "tsmc", "semiconductor", "blackwell_gpu", "sam_altman"] },
  { id: "p3", subreddit: "finance", title: "Powell sounded less dovish than the market wanted", snippet: "Rate-cut optimism got repriced. Higher-for-longer is back and recession risk ticked up.", sentiment: -0.45, score: 2890, mentions: ["jerome_powell", "federal_reserve", "fomc_decision", "interest_rates", "rate_cut_optimism", "recession_risk"] },
  { id: "p4", subreddit: "finance", title: "Bitcoin dumped 6% on the rate decision", snippet: "Crypto is a leveraged bet on liquidity. Every hawkish Fed headline hits BTC and ETH together.", sentiment: -0.4, score: 2210, mentions: ["bitcoin", "ethereum", "crypto_fear", "fomc_decision", "interest_rates", "liquidity"] },
  { id: "p5", subreddit: "finance", title: "Soft CPI revived rate-cut bets — chips and crypto ripped", snippet: "Cooling inflation pushed yields and the dollar down; spot BTC ETF inflows spiked.", sentiment: 0.42, score: 1980, mentions: ["cpi_release", "inflation", "rate_cut_optimism", "treasury_yields", "dollar_strength", "spot_btc_etf", "bitcoin"] },
  { id: "p6", subreddit: "finance", title: "Counting down to NVDA earnings — the only event that matters", snippet: "Options price a huge move. Blackwell ramp guidance is the whole ballgame; it's a market-wide risk event.", sentiment: 0.3, score: 1760, mentions: ["nvda_earnings", "nvidia", "blackwell_gpu", "earnings", "ai_euphoria"] },
  { id: "p7", subreddit: "technology", title: "Is the AI datacenter buildout a bubble?", snippet: "Circular financing between AI labs and chipmakers looks like past bubbles. The capex has to be paid back.", sentiment: -0.5, score: 1640, mentions: ["ai_bubble_risk", "ai_datacenter", "capex", "openai", "nvidia", "semiconductor"] },
  { id: "p8", subreddit: "finance", title: "Spot ETF inflows are quietly setting records", snippet: "Retail expresses the crypto thesis through ETFs. Flows track rate-cut optimism almost tick for tick.", sentiment: 0.35, score: 1420, mentions: ["spot_btc_etf", "bitcoin", "ethereum", "rate_cut_optimism", "coinbase"] },
  { id: "p9", subreddit: "worldnews", title: "New export controls hit advanced chips to China", snippet: "Tighter restrictions clip NVIDIA's China revenue and raise the Taiwan chokepoint premium.", sentiment: -0.4, score: 1310, mentions: ["export_controls", "nvidia", "semiconductor", "geopolitical_risk", "tsmc"] },
  { id: "p10", subreddit: "technology", title: "Altman hints at even larger compute plans", snippet: "Sam Altman's next-gen datacenter comments sent semis higher and reignited AI euphoria.", sentiment: 0.45, score: 1180, mentions: ["sam_altman", "openai", "ai_datacenter", "semiconductor", "ai_euphoria", "capex"] },
  { id: "p11", subreddit: "finance", title: "The AI power crunch is the next bottleneck", snippet: "Datacenter electricity demand is straining the grid; utilities and nuclear names are bid on it.", sentiment: 0.2, score: 1060, mentions: ["power_demand", "ai_datacenter", "capex"] },
  { id: "p12", subreddit: "finance", title: "Yields up, dollar up — gold and crypto under pressure", snippet: "Treasury yields and DXY climbing together is the classic headwind for gold and Bitcoin.", sentiment: -0.3, score: 980, mentions: ["treasury_yields", "dollar_strength", "gold", "bitcoin", "interest_rates"] },
  { id: "p13", subreddit: "finance", title: "QT is draining liquidity faster than people think", snippet: "As reserves fall, funding stress and liquidity risk creep back into the plumbing.", sentiment: -0.35, score: 910, mentions: ["liquidity", "liquidity_risk", "federal_reserve", "credit_risk"] },
  { id: "p14", subreddit: "finance", title: "Risk-off day: gold bid, AI names dumped", snippet: "De-grossing into the dollar and gold; the AI euphoria trade reversed hard intraday.", sentiment: -0.4, score: 870, mentions: ["risk_off", "gold", "ai_euphoria", "nvidia", "crypto_fear"] },
];

/* Drama derived from the most negative high-signal nodes. */
function deriveDrama(nodes) {
  return [...nodes]
    .filter((n) => n.sentiment < -0.2)
    .sort((a, b) => a.sentiment - b.sentiment)
    .slice(0, 3)
    .map((n) => ({
      keyword: n.label,
      spike: (1.5 + (1 - n.sentiment) * 1.2).toFixed(1),
      sentiment: n.sentiment.toFixed(2),
      comments: Math.round(n.evidenceCount * 60 + n.frequency * 4),
    }));
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Fresh, deep-cloned finance ontology graph (safe for D3 to mutate). */
export function getFinanceOntology() {
  const nodes = clone(FINANCE_NODES);
  return { nodes, edges: clone(FINANCE_EDGES), posts: clone(FINANCE_POSTS), drama: deriveDrama(nodes) };
}

/* ─── Legacy bridge — lifts original presets into the ontology contract ─── */
const round2 = (x) => Math.round(x * 100) / 100;
function inferType(node) {
  if (node.logo) return "Organization";
  if (node.sentiment <= -0.55) return "RiskSignal";
  return "Topic";
}

export function enrichLegacy(data, sub) {
  if (!data) return data;
  const nodes = data.nodes.map((n) => ({
    ...n,
    type: n.type || inferType(n),
    confidence: n.confidence ?? round2(0.6 + Math.min(0.35, n.frequency / 900)),
    evidenceCount: n.evidenceCount ?? Math.max(2, Math.round(n.frequency / 12)),
    shortSummary:
      n.shortSummary ||
      `"${n.label}" is active in r/${sub} with ${n.frequency} mentions and ${
        n.sentiment > 0.3 ? "positive" : n.sentiment < -0.3 ? "negative" : "mixed"
      } sentiment.`,
    sourceSubreddits: n.sourceSubreddits || [sub],
  }));
  const edges = data.edges.map((e) => ({
    ...e,
    type: e.type || "CO_OCCURS_WITH",
    confidence: e.confidence ?? round2(0.5 + (e.weight || 0.5) * 0.4),
    evidenceCount: e.evidenceCount ?? Math.max(1, Math.round((e.weight || 0.5) * 8)),
  }));
  const top = [...nodes].sort((a, b) => b.frequency - a.frequency).slice(0, 8);
  const posts = top.map((n, i) => ({
    id: `${sub}-p${i}`, subreddit: sub, title: `r/${sub}: discussion around ${n.label}`,
    snippet: n.shortSummary, sentiment: n.sentiment, score: Math.round(n.frequency * 6), mentions: [n.id],
  }));
  return { nodes, edges, posts, drama: data.drama };
}
