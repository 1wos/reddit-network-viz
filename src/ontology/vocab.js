/**
 * Vocabulary / alias resolver (gap filled from seocho's ManagedVocabularyResolver)
 *
 * Query-time alias normalization: maps colloquial/synonym phrases to canonical
 * ontology node ids BEFORE retrieval, so "the Fed" → federal_reserve, "team
 * green" → nvidia, "digital gold" → bitcoin. This is a lightweight semantic
 * overlay that sharply improves anchor recall for natural phrasing — the kind of
 * vocabulary layer a production ontology stack maintains as approved artifacts.
 */

const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* Curated alias map: canonical node id → alias phrases. Extend freely. */
export const ALIASES = {
  federal_reserve: ["the fed", "fed", "central bank", "the central bank", "fomc", "monetary authority"],
  jerome_powell: ["powell", "fed chair", "fed chairman"],
  nvidia: ["team green", "jensen's company", "huang's company", "the ai chip leader"],
  amd: ["team red"],
  bitcoin: ["btc", "digital gold"],
  ethereum: ["eth", "ether"],
  interest_rates: ["rate hikes", "rate cuts", "the rate path", "policy rate", "borrowing costs"],
  inflation: ["cpi print", "price pressures", "rising prices"],
  ai_datacenter: ["data center buildout", "compute buildout", "compute facilities", "ai infrastructure"],
  semiconductor: ["chips", "chip sector", "chipmakers"],
  capex: ["capital spending", "capex spend", "hyperscaler spending"],
  recession_risk: ["hard landing", "downturn risk"],
  ai_bubble_risk: ["ai bubble", "ai hype risk"],
  spot_btc_etf: ["spot etf", "bitcoin etf"],
  tsmc: ["the foundry", "taiwan foundry"],
  treasury_yields: ["bond yields", "10 year", "ten year yield"],
  dollar_strength: ["strong dollar", "dxy"],
};

export class VocabularyResolver {
  constructor(aliasMap = ALIASES) {
    // build normalized alias → canonicalId index, longest-first for greedy match
    this.index = [];
    for (const [id, phrases] of Object.entries(aliasMap)) {
      for (const p of phrases) this.index.push({ alias: normalize(p), id });
    }
    this.index.sort((a, b) => b.alias.length - a.alias.length);
  }

  /** Return [{ id, idx }] for canonical nodes whose alias appears in the text. */
  resolve(text) {
    const q = ` ${normalize(text)} `;
    const seen = new Set();
    const hits = [];
    for (const { alias, id } of this.index) {
      if (seen.has(id) || !alias) continue;
      const idx = q.indexOf(` ${alias} `);
      if (idx >= 0) { hits.push({ id, idx }); seen.add(id); }
    }
    return hits;
  }
}

export const defaultVocab = new VocabularyResolver();
