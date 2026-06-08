/**
 * FiQA ingestion smoke test — proves the REAL FiQA dataset builds a valid,
 * queryable ontology (not just the hand-authored mock).
 *   node scripts/fiqa-smoke.mjs
 */
import fs from "node:fs";
import { buildFiqaDataset } from "../src/ontology/ingest/fiqaDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { lintOntology } from "../src/ontology/lint.js";
import { answerWithGraphRAG } from "../src/ontology/engine/index.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) failed++; };

const rows = JSON.parse(fs.readFileSync(new URL("../data/fiqa-sentiment.json", import.meta.url)));
ok(rows.length > 1000, `loaded ${rows.length} real FiQA rows`);

const ds = buildFiqaDataset(rows);
const store = createStore(ds);

// 1) schema validity — real data conforms to the ontology contract
const v = store.validate();
ok(v.ok, `FiQA-built ontology passes schema validation${v.ok ? "" : `: ${JSON.stringify(v.errors.slice(0, 3))}`}`);

const posts = store.all("RedditPost").length;
const orgs = store.all("Organization");
const topics = store.all("Topic").length;
console.log(`   posts=${posts}  entities=${orgs.length}  topics=${topics}  links=${ds.links.length}`);
ok(posts > 1000 && posts <= rows.length, `${posts} unique posts from ${rows.length} rows (store dedups duplicate ids)`);
ok(orgs.length > 100, "100+ real financial entities extracted from `target`");
ok(topics > 0, "aspect roots became topics");

// 2) design lint runs on the real graph
const lint = lintOntology(store);
ok(typeof lint.ok === "boolean", `lint ran: ${lint.errors.length} errors, ${lint.warnings.length} warnings`);

// 3) the real-data graph is queryable via GraphRAG (anchor resolves, grounded)
const top = [...orgs].sort((a, b) => (b.frequency || 0) - (a.frequency || 0))[0];
const a = answerWithGraphRAG(store, `Why is ${top.label} trending?`);
console.log(`   top entity: ${top.label} (mentioned ${top.frequency}x, sentiment ${top.sentiment})`);
console.log(`   » ${a.summary}`);
ok(a.grounded && a.anchors[0]?.id === top.id, `GraphRAG anchors on the real entity (${top.label})`);

console.log(failed ? `\n❌ ${failed} failed` : "\n✅ ALL GREEN — real FiQA dataset → valid, queryable ontology");
process.exit(failed ? 1 : 0);
