import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitRule {
  limit: number;
  window: Duration;
}

/** Attempts allowed per sliding window, keyed by IP unless noted. */
const RATE_LIMITS = {
  signIn: { limit: 5, window: "15 m" }, // IP + email
  // Email alone, so rotating IPs can't keep guessing at one account.
  signInEmail: { limit: 20, window: "15 m" },
  register: { limit: 3, window: "1 h" },
  forgotPassword: { limit: 3, window: "1 h" },
  resetPassword: { limit: 5, window: "15 m" },
  resendVerification: { limit: 3, window: "15 m" }, // IP + email
  changePassword: { limit: 5, window: "15 m" }, // user id
  upload: { limit: 30, window: "1 h" }, // user id
  // AI requests (tag suggestions today), shared by every AI feature.
  ai: { limit: 20, window: "1 h" }, // user id
  // Email: "you already have an account" notices, so the form can't flood an inbox.
  accountExistsNotice: { limit: 1, window: "1 h" },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Unix time in milliseconds when the window frees up again. */
  reset: number;
}

// Past this the request is let through rather than left waiting on Upstash.
const UPSTASH_TIMEOUT_MS = 2000;

let redis: Redis | null | undefined;
const limiters = new Map<RateLimitName, Ratelimit>();

function getRedis(): Redis | null {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    // One retry keeps a network failure inside the timeout instead of the
    // client's default five-retry backoff.
    redis = url && token ? new Redis({ url, token, retry: { retries: 1 } }) : null;
  }
  return redis;
}

/** Null when Upstash isn't configured, so limiting is skipped. */
function getLimiter(name: RateLimitName): Ratelimit | null {
  const client = getRedis();
  if (!client) {
    return null;
  }

  let limiter = limiters.get(name);
  if (!limiter) {
    const { limit, window } = RATE_LIMITS[name];
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `ratelimit:${name}`,
      timeout: UPSTASH_TIMEOUT_MS,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

/**
 * Counts one attempt against `name` for `key`. Fails open: when Upstash is
 * unset, unreachable or slower than the timeout, the attempt is allowed.
 */
export async function rateLimit(name: RateLimitName, key: string): Promise<RateLimitResult> {
  const allowed = { success: true, remaining: RATE_LIMITS[name].limit, reset: Date.now() };
  const limiter = getLimiter(name);
  if (!limiter) {
    return allowed;
  }

  try {
    const { success, remaining, reset } = await limiter.limit(key);
    return { success, remaining, reset };
  } catch (error) {
    console.error(`Rate limit check failed for ${name}; allowing the request`, error);
    return allowed;
  }
}

/**
 * The client IP from `x-forwarded-for` (its first entry is the client on
 * Vercel, which overwrites the header) or `x-real-ip`. Behind a proxy that
 * passes the header through untouched, a client can set it to anything.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Whole seconds until `reset`, at least 1, for a `Retry-After` header. */
export function getRetryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

export function getRateLimitMessage(reset: number): string {
  const minutes = Math.ceil(getRetryAfterSeconds(reset) / 60);
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Counts an attempt against `name` for `key` and returns the message to show
 * when the limit is reached, or null when the attempt may go ahead (including
 * when rate limiting is off or failing open). For callers that don't need
 * `reset` for a `Retry-After` header.
 */
export async function getRateLimitError(name: RateLimitName, key: string): Promise<string | null> {
  const { success, reset } = await rateLimit(name, key);
  return success ? null : getRateLimitMessage(reset);
}
