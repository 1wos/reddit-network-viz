/**
 * DailyBriefing — "Daily Social Signal Brief" modal.
 *
 * One-click decision brief generated from the ontology graph: top trending
 * entity, biggest sentiment shift, emerging risk signal, communities involved,
 * a 3–5 bullet briefing and an evidence-backed note. Rendered as an overlay so
 * it never disturbs the existing layout.
 */
import { generateBriefing } from "../ontology/graphRagEngine.js";
import { nodeTypeColor } from "../ontology/schema.js";

const sentColor = (s, C) => (s > 0.3 ? C.pos : s < -0.3 ? C.neg : C.neu);

function Stat({ label, value, sub, color, C }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: "10px 12px", background: C.card, borderRadius: 9, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 8, color: C.dim, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'Space Grotesk',sans-serif", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.dim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function DailyBriefing({ data, sub, C, onClose }) {
  if (!data) return null;
  const b = generateBriefing(data, sub);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        animation: "slideUp .25s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px,96vw)", maxHeight: "90vh", overflow: "auto",
          background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
          boxShadow: "0 24px 60px rgba(0,0,0,.45)", padding: 22,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9, color: C.dim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>
              📋 Daily Social Signal Brief · r/{sub}
            </div>
            <h2 style={{
              margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif",
              background: `linear-gradient(90deg,${C.accent},${C.pink})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Market Intelligence Briefing</h2>
          </div>
          <button onClick={onClose} style={{
            background: C.card, border: `1px solid ${C.border}`, color: C.text,
            cursor: "pointer", fontSize: 16, borderRadius: 8, width: 30, height: 30, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Headline stats */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Stat label="Top Trending" value={b.topTrending.label}
            sub={`+${Math.max(0, b.topTrending.trend.at(-1) - b.topTrending.trend[0])} / 7d`}
            color={nodeTypeColor(b.topTrending.type, C)} C={C} />
          <Stat label="Biggest Sentiment Shift" value={b.sentimentShift.node.label}
            sub={`Δ ${b.sentimentShift.delta >= 0 ? "+" : ""}${b.sentimentShift.delta}`}
            color={sentColor(b.sentimentShift.node.sentiment, C)} C={C} />
          <Stat label="Emerging Risk" value={b.emergingRisk.label}
            sub={`sentiment ${b.emergingRisk.sentiment.toFixed(2)}`}
            color={C.neg} C={C} />
        </div>

        {/* Communities */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 8.5, color: C.dim, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Communities involved</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {b.communities.map((c) => (
              <span key={c} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 7,
                background: C.blue + "18", color: C.blue, border: `1px solid ${C.blue}40`,
              }}>r/{c}</span>
            ))}
          </div>
        </div>

        {/* Bullets */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 8.5, color: C.dim, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Briefing</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {b.bullets.map((line, i) => (
              <div key={i} style={{
                fontSize: 11.5, color: C.text, lineHeight: 1.5, padding: "8px 11px",
                background: C.card, borderRadius: 8, border: `1px solid ${C.border}`,
              }}>{line}</div>
            ))}
          </div>
        </div>

        {/* Evidence note */}
        <div style={{
          fontSize: 10, color: C.dim, padding: "9px 12px", borderRadius: 8,
          background: C.accentSoft, border: `1px solid ${C.accent}33`, lineHeight: 1.5,
        }}>
          🧾 {b.evidenceNote}
        </div>
      </div>
    </div>
  );
}
