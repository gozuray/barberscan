import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

/**
 * Rate limiter for NanoBananaPRO calls and /api/analyze endpoint.
 * Token-bucket-ish via sliding window. Falls back to a pass-through when
 * Redis is unavailable (e.g. local dev without Upstash).
 */
export const analyzeRateLimit = (() => {
  const r = getRedis();
  if (!r) {
    return {
      limit: async () => ({ success: true, remaining: Infinity, reset: 0 }),
    };
  }
  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "rl:analyze",
  });
})();

export const apiRateLimit = (() => {
  const r = getRedis();
  if (!r) {
    return {
      limit: async () => ({ success: true, remaining: Infinity, reset: 0 }),
    };
  }
  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: true,
    prefix: "rl:api",
  });
})();
