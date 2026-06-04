/**
 * Ontology — Action Type registry (kinetic / write-back layer)
 *
 * Actions are the Palantir-signature: parameterized, validated operations that
 * mutate the ontology state. Each declares params, a `validate(store, params)`
 * returning `true` or an error string, and `apply(store, params)` that mutates
 * via the store's primitives. The store wraps every dispatch with history +
 * persistence, so apply() just expresses the state change.
 */

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export const ACTION_TYPES = {
  acknowledgeSignal: {
    apiName: "acknowledgeSignal",
    label: "Acknowledge signal",
    params: { signalId: { type: "ref", ref: "Signal", required: true } },
    validate: (store, p) => {
      const s = store.get(p.signalId);
      if (!s) return "시그널을 찾을 수 없음";
      if (s.status !== "open") return "이미 처리된 시그널";
      return true;
    },
    apply: (store, p) => store.patch(p.signalId, { status: "ack", ackAt: store.now() }),
  },

  escalateRisk: {
    apiName: "escalateRisk",
    label: "Escalate risk",
    params: {
      signalId: { type: "ref", ref: "Signal", required: true },
      targetSignalId: { type: "ref", ref: "Signal" },
    },
    validate: (store, p) => {
      if (!store.get(p.signalId)) return "시그널을 찾을 수 없음";
      if (p.targetSignalId && !store.get(p.targetSignalId)) return "대상 시그널을 찾을 수 없음";
      if (p.targetSignalId === p.signalId) return "자기 자신으로 격상 불가";
      return true;
    },
    apply: (store, p) => {
      const s = store.get(p.signalId);
      store.patch(p.signalId, { magnitude: Math.min(1, (s.magnitude || 0) + 0.15) });
      if (p.targetSignalId) store.addLink("ESCALATES", p.signalId, p.targetSignalId, {});
    },
  },

  createWatchlist: {
    apiName: "createWatchlist",
    label: "Create watchlist",
    params: { name: { type: "string", required: true } },
    validate: (store, p) => (p.name && p.name.trim() ? true : "이름이 필요함"),
    apply: (store, p) => {
      const id = `wl_${slug(p.name)}_${store.now()}`;
      store.upsert("Watchlist", { id, label: p.name.trim(), entityIds: [], createdAt: store.now() });
      return id;
    },
  },

  addToWatchlist: {
    apiName: "addToWatchlist",
    label: "Add to watchlist",
    params: {
      entityId: { type: "ref", ref: "Entity", required: true },
      watchlistId: { type: "ref", ref: "Watchlist", required: true },
    },
    validate: (store, p) => {
      if (!store.get(p.entityId)) return "엔티티를 찾을 수 없음";
      const wl = store.get(p.watchlistId);
      if (!wl) return "워치리스트를 찾을 수 없음";
      if ((wl.entityIds || []).includes(p.entityId)) return "이미 워치리스트에 있음";
      return true;
    },
    apply: (store, p) => {
      const wl = store.get(p.watchlistId);
      store.patch(p.watchlistId, { entityIds: [...(wl.entityIds || []), p.entityId] });
    },
  },

  annotateEvidence: {
    apiName: "annotateEvidence",
    label: "Annotate evidence",
    params: {
      sourceId: { type: "ref", required: true },   // Signal or Entity
      postId: { type: "ref", ref: "RedditPost", required: true },
      note: { type: "string" },
    },
    validate: (store, p) => {
      if (!store.get(p.sourceId)) return "출처 객체를 찾을 수 없음";
      if (!store.get(p.postId)) return "게시글을 찾을 수 없음";
      return true;
    },
    apply: (store, p) =>
      store.addLink("EVIDENCED_BY", p.sourceId, p.postId, { note: p.note || "", manual: true }),
  },
};

export const actionType = (name) => ACTION_TYPES[name] || null;
