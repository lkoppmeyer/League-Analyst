// Simple in-memory cache with TTL
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private ttlMs: number;

  constructor(ttlSeconds: number = 3600) {
    this.ttlMs = ttlSeconds * 1000;
  }

  set(key: string, data: T): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// Rate limiter using token bucket algorithm (simplified)
export class RateLimiter {
  private requestTimestamps: number[] = [];
  private maxPerSecond: number;
  private maxPer2Minutes: number;

  constructor(maxPerSecond: number = 20, maxPer2Minutes: number = 100) {
    this.maxPerSecond = maxPerSecond;
    this.maxPer2Minutes = maxPer2Minutes;
  }

  isAllowed(): boolean {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const twoMinutesAgo = now - 120000;

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > twoMinutesAgo);

    // Check per-second limit
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneSecondAgo);
    if (recentRequests.length >= this.maxPerSecond) {
      return false;
    }

    // Check per-2-minutes limit
    if (this.requestTimestamps.length >= this.maxPer2Minutes) {
      return false;
    }

    this.requestTimestamps.push(now);
    return true;
  }

  reset(): void {
    this.requestTimestamps = [];
  }
}
