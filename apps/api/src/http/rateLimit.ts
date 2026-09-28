import { jsonError } from "./responses";

type RateLimitRule = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

declare global {
  var sporeRateLimitStore: RateLimitStore | undefined;
}

const store = globalThis.sporeRateLimitStore ?? new Map<string, RateLimitBucket>();
globalThis.sporeRateLimitStore = store;

const MAX_BUCKETS = 10_000;

export function rateLimit(request: Request, rule: RateLimitRule): Response | null {
  const now = Date.now();
  const key = `${rule.keyPrefix}:${clientKey(request)}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + rule.windowMs,
    });
    pruneExpiredBuckets(now);
    return null;
  }

  existing.count += 1;

  if (existing.count <= rule.limit) {
    return null;
  }

  return jsonError(429, "rate_limited", "Too many requests. Please try again soon.");
}

function clientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedClient ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function pruneExpiredBuckets(now: number) {
  if (store.size <= MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}
