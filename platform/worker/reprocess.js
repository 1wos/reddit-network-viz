/**
 * Dead-letter reprocess CLI.
 *   node platform/worker/reprocess.js            # show queue depths
 *   node platform/worker/reprocess.js --drain    # re-enqueue all DLQ jobs
 */
import { RedisQueue } from "./queue.js";

const queue = new RedisQueue("graphrag");
const drain = process.argv.includes("--drain");

const depth = await queue.depth();
console.log("queue depth:", JSON.stringify(depth));

if (drain) {
  const n = await queue.reprocessDLQ();
  console.log(`re-enqueued ${n} dead-lettered job(s)`);
}
process.exit(0);
