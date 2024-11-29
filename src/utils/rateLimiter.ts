import { redis } from '../../lib/redis';

export interface RateLimitConfig {
  points: number;        // Number of requests allowed
  duration: number;      // Time window in seconds
  blockDuration?: number; // Duration to block if limit exceeded (seconds)
  keyPrefix?: string;    // Prefix for Redis keys
}

export interface RateLimitInfo {
  remaining: number;     // Remaining points
  reset: number;        // Timestamp when points reset
  limit: number;        // Total points allowed
  blocked?: boolean;    // Whether the key is currently blocked
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'rate-limit:',
      blockDuration: config.duration,
      ...config,
    };
  }

  private getKeys(key: string) {
    const baseKey = `${this.config.keyPrefix}${key}`;
    return {
      points: `${baseKey}:points`,
      block: `${baseKey}:block`,
    };
  }

  async get(key: string): Promise<RateLimitInfo> {
    const keys = this.getKeys(key);
    const now = Math.floor(Date.now() / 1000);

    // Check if key is blocked
    const blockTTL = await redis.ttl(keys.block);
    if (blockTTL > 0) {
      return {
        remaining: 0,
        reset: now + blockTTL,
        limit: this.config.points,
        blocked: true,
      };
    }

    // Get remaining points and TTL
    const [points, pointsTTL] = await Promise.all([
      redis.get<number>(keys.points),
      redis.ttl(keys.points),
    ]);

    const remaining = points === null ? this.config.points : points;
    const reset = pointsTTL < 0 ? now : now + pointsTTL;

    return {
      remaining,
      reset,
      limit: this.config.points,
      blocked: false,
    };
  }

  async consume(key: string): Promise<RateLimitInfo> {
    const keys = this.getKeys(key);
    const now = Math.floor(Date.now() / 1000);

    // Check if key is blocked
    const blockTTL = await redis.ttl(keys.block);
    if (blockTTL > 0) {
      return {
        remaining: 0,
        reset: now + blockTTL,
        limit: this.config.points,
        blocked: true,
      };
    }

    // Initialize or get current points
    let points = await redis.get<number>(keys.points);
    let ttl = await redis.ttl(keys.points);

    if (points === null) {
      points = this.config.points;
      ttl = -1;
    }

    // If TTL expired, reset points
    if (ttl === -1) {
      await redis.setex(keys.points, this.config.duration, this.config.points);
      points = this.config.points;
    }

    // If no points remaining, optionally block the key
    if (points <= 0) {
      if (this.config.blockDuration) {
        await redis.setex(keys.block, this.config.blockDuration, 1);
        return {
          remaining: 0,
          reset: now + this.config.blockDuration,
          limit: this.config.points,
          blocked: true,
        };
      }
      return {
        remaining: 0,
        reset: now + (await redis.ttl(keys.points)),
        limit: this.config.points,
        blocked: false,
      };
    }

    // Consume a point
    await redis.decrby(keys.points, 1);

    return {
      remaining: points - 1,
      reset: now + (ttl === -1 ? this.config.duration : ttl),
      limit: this.config.points,
      blocked: false,
    };
  }

  async reset(key: string): Promise<void> {
    const keys = this.getKeys(key);
    await Promise.all([
      redis.del(keys.points),
      redis.del(keys.block),
    ]);
  }
}
