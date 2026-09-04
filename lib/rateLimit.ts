import "server-only";

// In-memory sliding-window limiter — this app runs as a single Next.js server
// instance (no Redis/edge KV in the stack), so a Map is sufficient, same convention
// lib/permissions.ts already uses for its profile cache. Not safe across multiple
// server instances/regions; revisit with a shared store if this ever scales out.
type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  // Bounded so a long-lived dev server can't grow this without limit, same guard
  // lib/permissions.ts's profile cache uses.
  if (buckets.size > 5000) buckets.clear();

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// Best-effort client identifier for rate limiting — `x-forwarded-for` is what
// Vercel (and most reverse proxies) set; falls back to a shared bucket for direct
// local connections where it's absent, which still rate-limits, just coarsely.
export function clientKeyFor(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
