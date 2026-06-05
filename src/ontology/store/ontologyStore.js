/**
 * Ontology Store — instances + schema validation + action dispatch
 *
 * Holds typed object instances and typed links, validates them against the
 * ObjectType registry, and applies Actions through a single `dispatch()` path
 * that records an append-only history and persists to localStorage. React can
 * `subscribe()` for reactive updates.
 *
 *   createStore(dataset, { objectTypes, linkTypes, actionTypes, persistKey })
 *     .validate() .dispatch(action, params) .subscribe(fn) .reset()
 */

import { OBJECT_TYPES } from "../types/objectTypes.js";
import { LINK_TYPES } from "../types/linkTypes.js";
import { ACTION_TYPES } from "../types/actionTypes.js";

const hasLS = () => {
  try { return typeof localStorage !== "undefined" && localStorage; } catch { return false; }
};

/* ── Single property validator ── */
function checkProp(value, d) {
  switch (d.type) {
    case "int": if (!Number.isInteger(value)) return "expected integer"; break;
    case "double": if (typeof value !== "number" || Number.isNaN(value)) return "expected number"; break;
    case "bool": if (typeof value !== "boolean") return "expected boolean"; break;
    case "string": case "ref": if (typeof value !== "string") return "expected string"; break;
    case "timestamp": if (typeof value !== "number") return "expected timestamp (number)"; break;
    case "enum": if (!d.enum.includes(value)) return `enum violation (${value})`; break;
    case "array": if (!Array.isArray(value)) return "expected array"; break;
    default: break;
  }
  if (d.range && typeof value === "number") {
    const [lo, hi] = d.range;
    if (value < lo || value > hi) return `out of range [${lo},${hi}] (${value})`;
  }
  return null;
}

export function createStore(dataset, opts = {}) {
  const objectTypes = opts.objectTypes || OBJECT_TYPES;
  const linkTypes = opts.linkTypes || LINK_TYPES;
  const actionTypes = opts.actionTypes || ACTION_TYPES;
  const persistKey = opts.persistKey || null;

  const byId = new Map();        // pk → instance (with __type)
  let links = [];                // { id, type, source, target, props }
  let history = [];              // append-only action log
  let linkSeq = 1;
  const listeners = new Set();

  const now = () => Date.now();
  const pkOf = (type, obj) => obj[objectTypes[type].pk];

  function loadObjects(objs) {
    byId.clear();
    for (const o of objs) byId.set(pkOf(o.__type, o), o);
  }

  // Hydrate from persistence if available, else from the supplied dataset.
  const persisted = persistKey && hasLS() ? hasLS().getItem(persistKey) : null;
  if (persisted) {
    try {
      const s = JSON.parse(persisted);
      loadObjects(s.objects || []);
      links = s.links || [];
      history = s.history || [];
      linkSeq = (links.reduce((m, l) => Math.max(m, +String(l.id).replace(/\D/g, "") || 0), 0)) + 1;
    } catch { loadObjects(dataset.objects); links = [...dataset.links]; }
  } else {
    loadObjects(dataset.objects);
    links = dataset.links.map((l) => ({ id: `l${linkSeq++}`, props: {}, ...l }));
  }

  const store = {
    now,

    /* ── Reads ── */
    get: (id) => byId.get(id) || null,
    has: (id) => byId.has(id),
    all: (type) => [...byId.values()].filter((o) => !type || o.__type === type),
    count: () => byId.size,
    getLinks: (f = {}) =>
      links.filter((l) =>
        (!f.type || l.type === f.type) && (!f.source || l.source === f.source) && (!f.target || l.target === f.target)),
    neighbors(id) {
      const out = [];
      for (const l of links) {
        if (l.source === id && byId.has(l.target)) out.push({ node: byId.get(l.target), type: l.type, props: l.props, dir: "out" });
        else if (l.target === id && byId.has(l.source)) out.push({ node: byId.get(l.source), type: l.type, props: l.props, dir: "in" });
      }
      return out;
    },
    history: () => [...history],

    /* ── Mutations (used by Action.apply; dispatch persists once) ── */
    upsert(type, obj) {
      const inst = { __type: type, __backingDataset: "action", __ingestedAt: now(), ...obj };
      byId.set(pkOf(type, inst), inst);
      return pkOf(type, inst);
    },
    patch(id, partial) {
      const cur = byId.get(id);
      if (!cur) throw new Error(`patch: unknown object ${id}`);
      byId.set(id, { ...cur, ...partial });
    },
    addLink(type, source, target, props = {}) {
      if (!linkTypes[type]) throw new Error(`addLink: unknown link type ${type}`);
      links.push({ id: `l${linkSeq++}`, type, source, target, props });
    },

    /* ── Validation against the ObjectType registry ── */
    validate() {
      const errors = [];
      for (const o of byId.values()) {
        const def = objectTypes[o.__type];
        if (!def) { errors.push({ id: o.__type, error: "unknown type" }); continue; }
        for (const [name, d] of Object.entries(def.properties)) {
          const v = o[name];
          if (v == null) { if (d.required) errors.push({ id: pkOf(o.__type, o), prop: name, error: "missing required" }); continue; }
          const e = checkProp(v, d);
          if (e) errors.push({ id: pkOf(o.__type, o), prop: name, error: e });
        }
      }
      return { ok: errors.length === 0, errors };
    },

    /* ── Action dispatch (the only write-back path UI should use) ── */
    dispatch(actionName, params = {}, actor = "user") {
      const a = actionTypes[actionName];
      if (!a) throw new Error(`unknown action ${actionName}`);
      const v = a.validate ? a.validate(store, params) : true;
      if (v !== true) throw new Error(typeof v === "string" ? v : "validation failed");
      const result = a.apply(store, params);
      history.push({ action: actionName, params, actor, at: now() });
      store._persist();
      store._notify();
      return result ?? store;
    },

    /* ── Reactivity + persistence ── */
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _notify() { for (const fn of listeners) fn(store); },
    _persist() {
      if (!persistKey || !hasLS()) return;
      try {
        hasLS().setItem(persistKey, JSON.stringify({ objects: [...byId.values()], links, history }));
      } catch { /* quota / serialization — non-fatal */ }
    },
    reset() {
      loadObjects(dataset.objects);
      links = dataset.links.map((l) => ({ id: `l${linkSeq++}`, props: {}, ...l }));
      history = [];
      if (persistKey && hasLS()) { try { hasLS().removeItem(persistKey); } catch { /* noop */ } }
      store._notify();
      return store;
    },
    snapshot: () => ({ objects: [...byId.values()], links: [...links], history: [...history] }),
  };

  return store;
}
