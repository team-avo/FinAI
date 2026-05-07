import { Redis } from "@upstash/redis";

// Cross-instance cache for Vercel serverless. Falls back to a per-process
// Map when Upstash isn't configured (local dev, or before env wiring) so
// callers don't have to branch on env presence.

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

const memCache = new Map<string, { value: unknown; expiresAt: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    const v = await redis.get<T>(key);
    return v ?? null;
  }
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
    return;
  }
  memCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
  });
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  memCache.delete(key);
}
