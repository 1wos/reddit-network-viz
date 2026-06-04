/**
 * EvidencePanel — evidence & lineage for the selected node.
 *
 * Turns a click into a decision-intelligence view: why the node is trending,
 * its top related nodes (with relationship type), evidence count, source
 * snippets, and sentiment / trend deltas. Styled to match the existing sidebar.
 */
import { getNodeEvidence } from "../ontology/graphRagEngine.js";
import { nodeTypeMeta, nodeTypeColor } from "../ontology/schema.js";

const sentColor = (s, C) => (s > 0.3 ? C.pos : s < -0.3 ? C.neg : C.neu);

function TypeChip({ type, C }) {
  const meta = nodeTypeMeta(type);
  const color = nodeTypeColor(type, C);
  return (
    <span style={{
      fontSize: 8, padding: "2px 6px", borderRadius: 5,
      background: color + "1f", color, border: `1px solid ${color}55`,
      letterSpacing: 0.5, whiteSpace: "nowrap",
    }}>
      {meta.glyph} {meta.label}
    </span>
  );
}

export default function EvidencePanel({ data, node, C }) {
  if (!data || !node) return null;
  const ev = getNodeEvidence(data, node);
  if (!ev) return null;

  const Delta = ({ label, value, good }) => (
    <div style={{ flex: 1, textAlign: "center", padding: "6px 4px", background: C.card, borderRadius: 7, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 7.5, color: C.dim, letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: good, fontFamily: "'Space Grotesk',sans-serif" }}>{value}</div>
    </div>
  );

  const td = ev.trendDelta;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif" }}>{node.label}</span>
        <TypeChip type={node.type} C={C} />
        {node.ticker && (
          <span style={{ fontSize: 9, color: C.accent, fontWeight: 600 }}>${node.ticker}</span>
        )}
      </div>

      {/* Why trending */}
      <div style={{ fontSize: 10.5, color: C.text, lineHeight: 1.55, marginBottom: 10 }}>
        {ev.whyTrending}
      </div>

      {/* Deltas */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Delta label="7D TREND" value={`${td.pct >= 0 ? "+" : ""}${td.pct}%`} good={td.abs >= 0 ? C.pos : C.neg} />
        <Delta label="SENT Δ" value={`${ev.sentimentDelta >= 0 ? "+" : ""}${ev.sentimentDelta}`} good={ev.sentimentDelta >= 0 ? C.pos : C.neg} />
        <Delta label="EVIDENCE" value={ev.evidenceCount} good={C.blue} />
        <Delta label="CONF" value={`${Math.round(ev.confidence * 100)}%`} good={C.purple} />
      </div>

      {/* Related nodes via relationship types */}
      {ev.related.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 8.5, color: C.dim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>🔗 Related (ontology links)</div>
          {ev.related.map((r, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 8px",
              background: C.card, borderRadius: 6, marginBottom: 4, border: `1px solid ${C.border}`,
            }}>
              <span style={{
                fontSize: 7.5, color: C.dim, fontFamily: "'JetBrains Mono',monospace",
                whiteSpace: "nowrap", opacity: 0.9,
              }}>
                {r.direction === "out" ? "→" : "←"} {r.edgeLabel}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: nodeTypeColor(r.type, C), flex: 1 }}>{r.label}</span>
              <span style={{ fontSize: 8, color: C.dim }}>{Math.round((r.weight || 0) * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Source snippets */}
      {ev.snippets.length > 0 && (
        <div>
          <div style={{ fontSize: 8.5, color: C.dim, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>📄 Evidence snippets</div>
          {ev.snippets.map((s, i) => (
            <div key={i} style={{
              padding: "7px 9px", background: C.bg, borderRadius: 7, marginBottom: 6,
              border: `1px solid ${C.border}`, borderLeft: `3px solid ${sentColor(s.sentiment, C)}`,
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: C.text, marginBottom: 3, lineHeight: 1.4 }}>{s.title}</div>
              <div style={{ fontSize: 9, color: C.dim, lineHeight: 1.5 }}>{s.snippet}</div>
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4, display: "flex", gap: 8 }}>
                <span>r/{s.subreddit}</span>
                <span style={{ color: sentColor(s.sentiment, C) }}>sent {s.sentiment > 0 ? "+" : ""}{s.sentiment.toFixed(2)}</span>
                {s.score != null && <span>▲ {s.score.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
