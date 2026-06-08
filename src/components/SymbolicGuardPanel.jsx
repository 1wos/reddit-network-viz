/**
 * SymbolicGuardPanel — the System-2 layer made visible
 *
 * Surfaces the Symbolic Guard ([src/ontology/symbolic/guard.js]) triaging the
 * finance risk signals: each candidate is checked against declarative rules and
 * gets a three-state verdict (valid / needs_review / invalid) with the rules that
 * fired and the graph path that justifies it — "neural proposes, symbolic checks".
 *
 * Note: this panel builds its OWN store from the STRICT buildUsFinanceDataset(),
 * NOT from the live `data` graph. The lenient datasetFromGraph adapter omits the
 * `magnitude`/`status` fields the guard's hard rules require, which would mark
 * every signal invalid. `data` is used only for best-effort node navigation.
 */
import { useMemo } from "react";
import { createStore } from "../ontology/store/ontologyStore.js";
import { buildUsFinanceDataset } from "../ontology/ingest/usFinanceDataset.js";
import { guardAllRiskSignals } from "../ontology/engine/index.js";

const DECISION = {
  valid: { label: "VALID", key: "pos" },
  needs_review: { label: "NEEDS REVIEW", key: "yellow" },
  invalid: { label: "INVALID", key: "neg" },
};

export default function SymbolicGuardPanel({ data, C, onSelectNode }) {
  // STRICT dataset → magnitude + status populated (lenient datasetFromGraph would not).
  // Deterministic + self-contained → memo has no deps, computed once. Do NOT switch
  // this to build from `data` or every signal goes invalid.
  const verdicts = useMemo(() => guardAllRiskSignals(createStore(buildUsFinanceDataset())), []);

  if (!data) return null;

  const navigable = (id) => !!data?.nodes?.find((n) => n.id === id);
  const go = (id) => { if (onSelectNode && navigable(id)) onSelectNode(id); };

  if (verdicts.length === 0) {
    return <div style={{ fontSize: 10, color: C.dim }}>No open risk signals to triage.</div>;
  }

  // Summary counts across the three decision states.
  const counts = verdicts.reduce((m, v) => ({ ...m, [v.decision]: (m[v.decision] || 0) + 1 }), {});

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {["valid", "needs_review", "invalid"].map((d) =>
          counts[d] ? (
            <span key={d} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 5, background: C[DECISION[d].key] + "1f", color: C[DECISION[d].key], border: `1px solid ${C[DECISION[d].key]}55`, letterSpacing: 0.5 }}>
              {counts[d]} {DECISION[d].label.toLowerCase()}
            </span>
          ) : null
        )}
      </div>

      {verdicts.map((v) => {
        const dec = DECISION[v.decision] || DECISION.invalid;
        const decColor = C[dec.key];
        const subjectLabel = v.explanationPath[0] || v.subject;
        return (
          <div key={v.subject} style={{ padding: "8px 10px", background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, borderLeft: `3px solid ${decColor}`, marginBottom: 6 }}>
            {/* Header: subject + decision badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              {navigable(v.subject) ? (
                <button onClick={() => go(v.subject)} style={{ padding: "2px 6px", borderRadius: 5, background: decColor + "18", color: decColor, border: `1px solid ${decColor}44`, fontSize: 9.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>{subjectLabel}</button>
              ) : (
                <span style={{ fontSize: 9.5, fontWeight: 600, color: C.text }}>{subjectLabel}</span>
              )}
              <span style={{ fontSize: 8.5, padding: "2px 6px", borderRadius: 5, background: decColor + "22", color: decColor, fontWeight: 700, letterSpacing: 0.5, border: `1px solid ${decColor}55`, marginLeft: "auto" }}>{dec.label}</span>
            </div>

            {/* explanation_path */}
            {v.explanationPath.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 6 }}>
                {v.explanationPath.map((seg, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {navigable(seg) ? (
                      <button onClick={() => go(seg)} style={{ padding: "2px 6px", borderRadius: 5, background: C.blue + "18", color: C.blue, border: `1px solid ${C.blue}44`, fontSize: 8.5, fontFamily: "inherit", cursor: "pointer" }}>{seg}</button>
                    ) : (
                      <span style={{ padding: "2px 6px", borderRadius: 5, background: C.bg, color: C.dim, border: `1px solid ${C.border}`, fontSize: 8.5 }}>{seg}</span>
                    )}
                    {i < v.explanationPath.length - 1 && <span style={{ color: C.dim, fontSize: 9 }}>→</span>}
                  </span>
                ))}
              </div>
            )}

            {/* fired rules */}
            {v.firedRules.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: v.unmet.length ? 6 : 0 }}>
                {v.firedRules.map((r) => (
                  <span key={r} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 5, background: C.pos + "1f", color: C.pos, border: `1px solid ${C.pos}55`, letterSpacing: 0.3 }}>✓ {r}</span>
                ))}
              </div>
            )}

            {/* unmet rules (by severity) */}
            {v.unmet.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {v.unmet.map((u) => {
                  const uColor = u.severity === "hard" ? C.neg : C.yellow;
                  return (
                    <span key={u.name} title={u.detail} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 5, background: uColor + "1f", color: uColor, border: `1px solid ${uColor}55`, letterSpacing: 0.3 }}>✗ {u.name} ({u.severity})</span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
