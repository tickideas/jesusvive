// In-process sliding-window rate limiter with LRU-style eviction.
// Single-replica deployments only. For multi-replica, swap for Redis/Upstash.

const buckets = new Map<string, number[]>();

// Hard cap on distinct keys to bound memory under a flood of unique IPs.
// Map iteration order is insertion order; we re-insert on every allowed hit
// so the first key is the least-recently-used (rejected hits are not
// promoted, so abusers can't keep themselves alive in the cache).
const MAX_BUCKETS = 100_000;

// Idle buckets older than this are swept regardless of their original window.
// Any route whose limit window approaches this should reconsider the limiter.
const SWEEP_STALE_MS = 60 * 60_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function touch(key: string, hits: number[]): void {
  // Move to most-recently-used position by re-inserting.
  buckets.delete(key);
  buckets.set(key, hits);
}

function evictOneOlderThan(cutoff: number): void {
  // Drop the oldest bucket only if all its hits are stale. This keeps a
  // unique-IP flood from kicking out users mid-burst.
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] < cutoff) {
      buckets.delete(key);
      return;
    }
    // The first key is the LRU; if its newest hit is still in window, every
    // other bucket is at least as fresh, so stop.
    break;
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  let hits = buckets.get(key);
  if (!hits) {
    if (buckets.size >= MAX_BUCKETS) {
      evictOneOlderThan(cutoff);
      // If nothing was evictable, fall through anyway: setting a new key
      // grows the Map by one — preferred over rejecting legitimate traffic.
    }
    hits = [];
    buckets.set(key, hits);
  } else {
    // Drop expired hits in place.
    let firstFresh = 0;
    while (firstFresh < hits.length && hits[firstFresh] <= cutoff) firstFresh++;
    if (firstFresh > 0) hits.splice(0, firstFresh);
  }

  if (hits.length >= limit) {
    // Do not touch on rejection: abusers shouldn't refresh LRU position.
    return {
      allowed: false,
      remaining: 0,
      resetAt: hits[0] + windowMs,
    };
  }

  hits.push(now);
  touch(key, hits);
  return {
    allowed: true,
    remaining: limit - hits.length,
    resetAt: hits[0] + windowMs,
  };
}

// Test-only helper: reset internal state between specs.
export function __resetRateLimit(): void {
  buckets.clear();
}

// Opportunistic cleanup to keep the Map bounded.
// Prod-only + globalThis-guarded so HMR doesn't leak timers in dev.
const g = globalThis as unknown as { __rlSweepTimer?: NodeJS.Timeout };
if (process.env.NODE_ENV === 'production' && !g.__rlSweepTimer) {
  g.__rlSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, hits] of buckets) {
      if (hits.length === 0 || hits[hits.length - 1] < now - SWEEP_STALE_MS) {
        buckets.delete(key);
      }
    }
  }, 60_000);
  g.__rlSweepTimer.unref?.();
}
