/**
 * Engine — Ontology Context
 *
 * A compact, hashable descriptor of the live ontology (types, relations, live
 * counts). Borrowed from seocho's invariant: the SAME ontology context must
 * travel the whole loop (ingest → store → query → answer), so every answer can
 * cite the exact contract+hash it was grounded against.
 */

import { OBJECT_TYPES } from "../types/objectTypes.js";
import { LINK_TYPES } from "../types/linkTypes.js";

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** Build the shared ontology context descriptor for a live store. */
export function buildOntologyContext(store) {
  const objectCounts = {};
  for (const o of store.all()) objectCounts[o.__type] = (objectCounts[o.__type] || 0) + 1;
  const linkCounts = {};
  for (const l of store.getLinks()) linkCounts[l.type] = (linkCounts[l.type] || 0) + 1;

  const objectTypes = Object.keys(OBJECT_TYPES).filter((t) => !OBJECT_TYPES[t].abstract);
  const linkTypes = Object.keys(LINK_TYPES);
  const descriptor = { objectTypes, linkTypes, objectCounts, linkCounts };
  return { ...descriptor, hash: djb2(JSON.stringify(descriptor)) };
}
