export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = {
  windowStartedAt: number;
  count: number;
};

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, now = Date.now()): RateLimitDecision {
    const bucket = this.readBucket(key, now);
    bucket.count += 1;
    this.buckets.set(key, bucket);

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStartedAt + this.windowMs - now) / 1000));
    const remaining = Math.max(0, this.limit - bucket.count);

    return {
      allowed: bucket.count <= this.limit,
      limit: this.limit,
      remaining,
      retryAfterSeconds,
    };
  }

  snapshot() {
    return {
      keys: this.buckets.size,
      limit: this.limit,
      windowMs: this.windowMs,
    };
  }

  private readBucket(key: string, now: number): Bucket {
    const current = this.buckets.get(key);
    if (!current || now - current.windowStartedAt >= this.windowMs) {
      this.cleanup(now);
      return {
        windowStartedAt: now,
        count: 0,
      };
    }

    return current;
  }

  private cleanup(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStartedAt >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}
