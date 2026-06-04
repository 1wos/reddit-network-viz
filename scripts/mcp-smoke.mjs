/**
 * MCP tools smoke test — exercises every tool handler directly (no transport).
 *   node scripts/mcp-smoke.mjs
 */
import { createOntologyTools } from "../mcp/tools.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) failed++; };

const t = createOntologyTools();
ok(t.names().length === 7, `툴 7종 노출: ${t.names().join(", ")}`);

const sem = t.call("ontology_semantic_search", { query: "chip supply chain for AI", k: 3 });
ok(Array.isArray(sem) && sem.length === 3 && sem[0].score != null, `semantic_search: ${sem.map((s) => s.id).join(", ")}`);

const cat = t.call("ontology_catalog");
ok(cat.objectTypes.length >= 11 && typeof cat.contextHash === "string", `catalog: ${cat.objectTypes.length} types, ctx=${cat.contextHash}`);

const ans = t.call("ontology_answer", { question: "Why is NVIDIA trending across finance and technology?" });
ok(ans.supportStatus === "supported" && ans.evidence.length > 0, `answer: support=${ans.supportStatus}, evidence=${ans.evidence.length}`);

const lin = t.call("ontology_lineage", { id: "recession_risk" });
ok(lin.posts?.length > 0, `lineage(recession_risk): posts=${lin.posts?.length}, subs=${JSON.stringify(lin.subreddits)}`);

const nb = t.call("ontology_neighbors", { id: "nvidia" });
ok(nb.neighbors.length > 0, `neighbors(nvidia): ${nb.neighbors.length}`);

const a1 = t.call("ontology_action", { action: "acknowledgeSignal", params: { signalId: "recession_risk" } });
ok(a1.ok, `action acknowledgeSignal → ok=${a1.ok}`);
const a2 = t.call("ontology_action", { action: "acknowledgeSignal", params: { signalId: "recession_risk" } });
ok(!a2.ok, `재처리 거부 → ok=${a2.ok} (${a2.error})`);
const a3 = t.call("ontology_action", { action: "createWatchlist", params: { name: "AI Capex" } });
ok(a3.ok, `action createWatchlist → ${a3.result}`);

const brief = t.call("ontology_briefing");
ok(brief.bullets?.length >= 3, `briefing: ${brief.bullets?.length} bullets, top=${brief.topTrending?.label}`);

console.log(failed ? `\n❌ ${failed} 실패` : "\n✅ ALL GREEN — MCP 툴 7종 (structured context protocol) 통과");
process.exit(failed ? 1 : 0);
