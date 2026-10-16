type UnlockAttempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};

type RateLimitOptions = {
  maxFailures?: number;
  windowMs?: number;
  blockMs?: number;
  maxEntries?: number;
};

export type PayrollUnlockRateLimit = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1_000;
const DEFAULT_BLOCK_MS = 15 * 60 * 1_000;
const DEFAULT_MAX_ENTRIES = 256;

export class PayrollUnlockRateLimiter {
  private readonly attempts = new Map<string, UnlockAttempt>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly blockMs: number;
  private readonly maxEntries: number;

  constructor(options: RateLimitOptions = {}) {
    this.maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.blockMs = options.blockMs ?? DEFAULT_BLOCK_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  check(key: string, now = Date.now()): PayrollUnlockRateLimit {
    const attempt = this.attempts.get(key);
    if (!attempt) return { allowed: true, retryAfterSeconds: 0 };
    if (attempt.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((attempt.blockedUntil - now) / 1_000),
      };
    }
    if (now - attempt.windowStartedAt >= this.windowMs) this.attempts.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  recordFailure(key: string, now = Date.now()): PayrollUnlockRateLimit {
    this.prune(now);
    const current = this.attempts.get(key);
    const attempt = !current || now - current.windowStartedAt >= this.windowMs
      ? { failures: 1, windowStartedAt: now, blockedUntil: 0 }
      : { ...current, failures: current.failures + 1 };
    if (attempt.failures >= this.maxFailures) attempt.blockedUntil = now + this.blockMs;
    this.attempts.set(key, attempt);
    return this.check(key, now);
  }

  reset(key: string) {
    this.attempts.delete(key);
  }

  private prune(now: number) {
    for (const [key, attempt] of this.attempts) {
      const expired = attempt.blockedUntil > 0
        ? attempt.blockedUntil <= now
        : now - attempt.windowStartedAt >= this.windowMs;
      if (expired) this.attempts.delete(key);
    }
    while (this.attempts.size >= this.maxEntries) {
      const oldest = this.attempts.keys().next().value;
      if (oldest == null) break;
      this.attempts.delete(oldest);
    }
  }
}

export function payrollUnlockClientKey(requestHeaders: Pick<Headers, "get">) {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || requestHeaders.get("x-real-ip")?.trim() || "private-client";
  return value.slice(0, 128);
}

export const payrollUnlockRateLimiter = new PayrollUnlockRateLimiter();
