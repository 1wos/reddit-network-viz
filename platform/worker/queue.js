/**
 * Resilient Redis queue (BRPOP main list + delayed-retry ZSET + DLQ + idempotency).
 *
 * Design:
 *  - main list   `q:<name>`        — ready jobs (LPUSH / BRPOP)
 *  - delayed zset`q:<name>:delayed`— retries scheduled by readyAt (score)
 *  - dlq list    `q:<name>:dlq`    — exhausted jobs for manual reprocess
 *  - idempotency set `q:<name>:seen`— completed idempotency keys (dedupe)
 *
 * Job: { id, type, payload, idempotencyKey?, traceparent?, attempts }
 */
import IORedis from "ioredis";

export class RedisQueue {
  constructor(name, { url, maxRetries = 3, baseDelayMs = 500 } = {}) {
    this.name = name;
    this.redis = new IORedis(url || process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.key = `q:${name}`;
    this.delayedKey = `q:${name}:delayed`;
    this.dlqKey = `q:${name}:dlq`;
    this.seenKey = `q:${name}:seen`;
    this.running = false;
  }

  /** Enqueue a job; idempotency key dedupes already-completed work. */
  async enqueue(job) {
    const j = { id: job.id || `${this.name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, attempts: 0, ...job };
    if (j.idempotencyKey && (await this.redis.sismember(this.seenKey, j.idempotencyKey))) {
      return { skipped: true, reason: "idempotent", id: j.id };
    }
    await this.redis.lpush(this.key, JSON.stringify(j));
    return { enqueued: true, id: j.id };
  }

  /** Move any due delayed-retry jobs back onto the main list. */
  async _promoteDelayed(now) {
    const due = await this.redis.zrangebyscore(this.delayedKey, 0, now, "LIMIT", 0, 20);
    for (const raw of due) {
      const removed = await this.redis.zrem(this.delayedKey, raw);
      if (removed) await this.redis.lpush(this.key, raw);
    }
  }

  /** Consume jobs forever. `handler(job)` resolves on success or throws to retry. */
  async consume(handler) {
    this.running = true;
    while (this.running) {
      await this._promoteDelayed(Date.now());
      const res = await this.redis.brpop(this.key, 1); // 1s block → lets us poll delayed set
      if (!res) continue;
      let job;
      try { job = JSON.parse(res[1]); } catch { continue; }
      try {
        await handler(job);
        if (job.idempotencyKey) await this.redis.sadd(this.seenKey, job.idempotencyKey);
      } catch (err) {
        await this._onFailure(job, err);
      }
    }
  }

  async _onFailure(job, err) {
    job.attempts = (job.attempts || 0) + 1;
    job.lastError = String(err?.message || err).slice(0, 300);
    if (job.attempts <= this.maxRetries) {
      const delay = this.baseDelayMs * 2 ** (job.attempts - 1); // exponential backoff
      await this.redis.zadd(this.delayedKey, Date.now() + delay, JSON.stringify(job));
    } else {
      await this.redis.lpush(this.dlqKey, JSON.stringify(job)); // dead-letter
    }
  }

  async depth() {
    const [main, delayed, dlq] = await Promise.all([
      this.redis.llen(this.key), this.redis.zcard(this.delayedKey), this.redis.llen(this.dlqKey),
    ]);
    return { main, delayed, dlq };
  }

  /** Re-enqueue all dead-lettered jobs (used by the reprocess CLI). */
  async reprocessDLQ() {
    let n = 0, raw;
    while ((raw = await this.redis.rpoplpush(this.dlqKey, this.key))) {
      const j = JSON.parse(raw); j.attempts = 0; // reset for a fresh run
      await this.redis.lset(this.key, 0, JSON.stringify(j));
      n++;
    }
    return n;
  }

  stop() { this.running = false; }
}
