/**
 * OntologyQueryPanel — GraphRAG query panel (engine-connected)
 *
 * Builds a live ontology store from the loaded graph and answers questions with
 * the store-native GraphRAG engine: intent → slots → subgraph → evidence bundle
 * → grounded answer. Surfaces the engine's honesty signals in the demo:
 * supportStatus (supported / partial / unsupported), missing slots, the impact
 * path, evidence snippets, and the ontology-context hash the answer was grounded against.
 */
import { useState, useMemo } from "react";
import { createStore } from "../ontology/store/ontologyStore.js";
import { datasetFromGraph } from "../ontology/ingest/datasetFromGraph.js";
import { answerWithGraphRAG, buildVectorIndex, ENGINE_QUESTIONS } from "../ontology/engine/index.js";
import { nodeTypeColor } from "../ontology/schema.js";

const sentColor = (s, C) => (s > 0.3 ? C.pos : s < -0.3 ? C.neg : C.neu);
const SUPPORT = {
  supported: { label: "SUPPORTED", key: "pos" },
  partial: { label: "PARTIAL", key: "yellow" },
  unsupported: { label: "UNSUPPORTED", key: "neg" },
};

export default function OntologyQueryPanel({ data, C, onSelectNode }) {
  const store = useMemo(() => (data ? createStore(datasetFromGraph(data)) : null), [data]);
  const index = useMemo(() => (store ? buildVectorIndex(store) : null), [store]); // contextual embeddings → hybrid retrieval
  const [q, setQ] = useState("");
  const [ans, setAns] = useState(null);

  if (!data) return null;

  const ask = (question) => {
    if (!question || !question.trim() || !store) return;
    setQ(question);
    setAns(answerWithGraphRAG(store, question, { index }));
  };

  const sup = ans && (SUPPORT[ans.supportStatus] || SUPPORT.partial);
  const supColor = sup && C[sup.key];

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the ontology…"
          style={{ flex: 1, minWidth: 0, padding: "6px 9px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 10, fontFamily: "inherit", outline: "none" }} />
        <button type="submit" style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: `linear-gradient(135deg,${C.accent},${C.pink})`, color: "#fff", fontSize: 10, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Ask</button>
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: ans ? 12 : 0 }}>
        {ENGINE_QUESTIONS.map((p, i) => (
          <button key={i} onClick={() => ask(p)} title={p} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 8.5, fontFamily: "inherit", cursor: "pointer", textAlign: "left", lineHeight: 1.3 }}>
            {p.length > 40 ? p.slice(0, 38) + "…" : p}
          </button>
        ))}
      </div>

      {ans && (
        <div style={{ animation: "slideUp .3s ease" }}>
          {/* Header: intent + support status + confidence */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8.5, padding: "2px 6px", borderRadius: 5, background: C.blue + "20", color: C.blue, letterSpacing: 0.5 }}>{ans.intent.label}</span>
            <span style={{ fontSize: 8.5, padding: "2px 6px", borderRadius: 5, background: supColor + "22", color: supColor, fontWeight: 700, letterSpacing: 0.5, border: `1px solid ${supColor}55` }}>{sup.label}</span>
            {ans.retrieval && ans.retrieval !== "none" && (
              <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 5, background: C.cyan + "18", color: C.cyan, letterSpacing: 0.5 }} title="anchor retrieval mode">{ans.retrieval === "semantic" ? "🔎 vector" : ans.retrieval}</span>
            )}
            <span style={{ fontSize: 8, color: C.purple }}>conf {Math.round(ans.confidence * 100)}%</span>
            <span style={{ fontSize: 7.5, color: C.dim, marginLeft: "auto" }} title="ontology context hash">ctx·{ans.context?.hash}</span>
          </div>

          <div style={{ padding: "9px 11px", background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8, fontSize: 10.5, color: C.text, lineHeight: 1.55 }}>
            {ans.summary}
          </div>

          {/* Impact path */}
          {ans.path?.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 8 }}>
              {ans.path.map((s, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => onSelectNode?.(s.id)} style={{ padding: "2px 6px", borderRadius: 5, background: nodeTypeColor(s.type, C) + "18", color: nodeTypeColor(s.type, C), border: `1px solid ${nodeTypeColor(s.type, C)}44`, fontSize: 8.5, fontFamily: "inherit", cursor: "pointer" }}>{s.label}</button>
                  {i < ans.path.length - 1 && <span style={{ color: C.dim, fontSize: 9 }}>→</span>}
                </span>
              ))}
            </div>
          )}

          {/* Related nodes (slot fills) */}
          {ans.relatedNodes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {ans.relatedNodes.map((n) => (
                <button key={n.id} onClick={() => onSelectNode?.(n.id)} title={n.via} style={{ padding: "3px 7px", borderRadius: 6, cursor: "pointer", background: nodeTypeColor(n.type, C) + "18", color: nodeTypeColor(n.type, C), border: `1px solid ${nodeTypeColor(n.type, C)}44`, fontSize: 9, fontFamily: "inherit" }}>{n.label}</button>
              ))}
            </div>
          )}

          {/* Missing slots — honesty signal */}
          {ans.missingSlots?.length > 0 && (
            <div style={{ fontSize: 9, color: C.neg, marginBottom: 8, padding: "5px 8px", background: C.neg + "0e", borderRadius: 6, border: `1px solid ${C.neg}33` }}>
              ⚠ Not evidenced in graph: {ans.missingSlots.join(", ")}
            </div>
          )}

          {/* Evidence */}
          {ans.evidence.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {ans.evidence.map((s, i) => (
                <div key={i} style={{ padding: "6px 8px", background: C.bg, borderRadius: 6, marginBottom: 4, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sentColor(s.sentiment, C)}` }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{s.title}</div>
                  <div style={{ fontSize: 8.5, color: C.dim, marginTop: 2, lineHeight: 1.45 }}>{s.snippet}</div>
                  <div style={{ fontSize: 7.5, color: C.dim, marginTop: 3 }}>r/{s.subreddit} · ▲ {s.score?.toLocaleString?.() ?? s.score}</div>
                </div>
              ))}
            </div>
          )}

          {/* Follow-ups */}
          {ans.followUps?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {ans.followUps.map((f, i) => (
                <button key={i} onClick={() => ask(f)} style={{ textAlign: "left", padding: "4px 7px", borderRadius: 6, background: "transparent", border: `1px dashed ${C.border}`, color: C.blue, fontSize: 9, fontFamily: "inherit", cursor: "pointer" }}>↳ {f}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
