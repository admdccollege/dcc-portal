/**
 * Minimal fixed-window rate limiter (in-memory, per server instance).
 * Adequate for a single-instance deployment and as a first line of defence;
 * for multi-instance/serverless deployments back this with a shared store
 * (e.g. Upstash Redis). Supabase Auth applies its own login rate limits.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}
