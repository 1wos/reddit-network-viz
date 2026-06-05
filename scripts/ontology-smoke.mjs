/**
 * Ontology store smoke test — schema validation, write-back actions, derived
 * functions and lineage, run headlessly.
 *   node scripts/ontology-smoke.mjs
 * Exits non-zero on any failed assertion.
 */
import { buildUsFinanceDataset } from "../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../src/ontology/store/ontologyStore.js";
import { runFunction } from "../src/ontology/functions/index.js";
import { traceLineage } from "../src/ontology/lineage.js";

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✅" : "❌"} ${msg}`); if (!cond) failed++; };

// 1) Build + validate against the type registry
const dataset = buildUsFinanceDataset();
const store = createStore(dataset); // no persistKey → pure in-memory (Node-safe)
const v = store.validate();
ok(v.ok, `schema validation passed (${store.count()} objects, ${store.getLinks().length} links)` +
  (v.ok ? "" : ` — errors: ${JSON.stringify(v.errors.slice(0, 4))}`));

// object counts by type
const counts = {};
for (const o of store.all()) counts[o.__type] = (counts[o.__type] || 0) + 1;
console.log("   by type:", JSON.stringify(counts));

// 2) Action: acknowledgeSignal (open → ack)
const sig = store.all("RiskSignal")[0];
ok(sig.status === "open", `initial signal status=open (${sig.id})`);
store.dispatch("acknowledgeSignal", { signalId: sig.id });
ok(store.get(sig.id).status === "ack", "acknowledgeSignal → status=ack");
let threw = false; try { store.dispatch("acknowledgeSignal", { signalId: sig.id }); } catch { threw = true; }
ok(threw, "re-acking an ack'd signal is rejected");

// 3) Action: escalateRisk (magnitude↑ + ESCALATES link)
const before = store.get("recession_risk").magnitude;
store.dispatch("escalateRisk", { signalId: "recession_risk", targetSignalId: "ai_bubble_risk" });
ok(store.get("recession_risk").magnitude > before, "escalateRisk → magnitude increased");
ok(store.getLinks({ type: "ESCALATES", source: "recession_risk", target: "ai_bubble_risk" }).length > 0,
  "escalateRisk → ESCALATES link created");

// 4) Action: createWatchlist + addToWatchlist
const wlId = store.dispatch("createWatchlist", { name: "AI Capex" });
ok(store.get(wlId)?.__type === "Watchlist", `createWatchlist → ${wlId}`);
store.dispatch("addToWatchlist", { entityId: "nvidia", watchlistId: wlId });
ok(store.get(wlId).entityIds.includes("nvidia"), "addToWatchlist → nvidia in entityIds");

// 5) Action: annotateEvidence (manual EVIDENCED_BY)
store.dispatch("annotateEvidence", { sourceId: "nvidia", postId: "p6", note: "earnings setup" });
ok(store.getLinks({ type: "EVIDENCED_BY", source: "nvidia", target: "p6" }).some((l) => l.props.manual),
  "annotateEvidence → manual EVIDENCED_BY link");

// 6) Functions
const nvda = store.get("nvidia");
ok(typeof runFunction(nvda, "momentum", store) === "number", `Fn momentum(nvidia)=${runFunction(nvda, "momentum", store)}`);
ok(typeof runFunction(nvda, "sentimentScore", store) === "number", `Fn sentimentScore(nvidia)=${runFunction(nvda, "sentimentScore", store)}`);
const btc = store.get("bitcoin");
const rs = runFunction(btc, "riskScore", store);
ok(rs >= 0 && rs <= 1, `Fn riskScore(bitcoin)=${rs} ∈ [0,1]`);

// 7) Lineage trace
const lin = traceLineage(store, "recession_risk");
ok(lin && lin.posts.length > 0, `Lineage recession_risk → posts ${lin?.posts.length}, subs ${JSON.stringify(lin?.subreddits)}`);

// 8) History log
ok(store.history().length >= 5, `history log: ${store.history().length} entries (append-only)`);

console.log(failed ? `\n❌ ${failed} failed` : "\n✅ ALL GREEN — ontology store acceptance checks");
process.exit(failed ? 1 : 0);
