/**
 * Job handlers — the polyglot worker reuses the SAME JS ontology engine, so the
 * platform layer doesn't reimplement logic. Each handler is idempotent-friendly
 * and throws on failure (queue handles retry/backoff/DLQ).
 *
 * Job types: ingest · embedding · graph_write · eval · answer
 */
import { buildUsFinanceDataset } from "../../src/ontology/ingest/usFinanceDataset.js";
import { createStore } from "../../src/ontology/store/ontologyStore.js";
import { buildVectorIndex } from "../../src/ontology/embeddings/index.js";
import { answerWithGraphRAG } from "../../src/ontology/engine/index.js";
import { lintOntology } from "../../src/ontology/lint.js";
import { runEval } from "../../eval/harness.js";
import { GOLDEN_SET } from "../../eval/goldenset.js";

// In prod this is a graph DB; here a process-local store stands in.
let _store, _index;
function ctx() {
  if (!_store) { _store = createStore(buildUsFinanceDataset()); _index = buildVectorIndex(_store); }
  return { store: _store, index: _index };
}

/* Injected fault for demoing retry/DLQ: payload.fail === true throws. */
function maybeFail(job) {
  if (job.payload?.fail) throw new Error(`injected failure (attempt ${job.attempts})`);
}

export const handlers = {
  async ingest(job) {
    maybeFail(job);
    const { store } = ctx();
    const v = lintOntology(store);
    if (!v.ok) throw new Error(`ingest validation failed: ${v.errors.length} errors`);
    return { ingested: store.count(), links: store.getLinks().length, valid: v.ok };
  },
  async embedding(job) {
    maybeFail(job);
    const { store } = ctx();
    _index = buildVectorIndex(store);
    return { vectors: _index.size };
  },
  async graph_write(job) {
    maybeFail(job);
    const { store } = ctx();
    const { action, params } = job.payload || {};
    store.dispatch(action, params); // write-back action; throws on invalid → retried
    return { action, ok: true, history: store.history().length };
  },
  async eval(job) {
    maybeFail(job);
    const { store, index } = ctx();
    const { scorecard } = runEval(store, index, GOLDEN_SET);
    return scorecard;
  },
  async answer(job) {
    maybeFail(job);
    const { store, index } = ctx();
    const a = answerWithGraphRAG(store, job.payload?.question || "", { index });
    return { supportStatus: a.supportStatus, summary: a.summary };
  },
};
