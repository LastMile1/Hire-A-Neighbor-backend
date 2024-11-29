import { Redis } from '@upstash/redis';
import { RateLimiterConfig, RateLimitInfo } from './types';
import { CircuitBreaker } from './CircuitBreaker';
import { RateLimitMonitoring } from './monitoring';
import { RATE_LIMIT_DEFAULTS, RATE_LIMIT_ERRORS } from './constants';

export class RateLimiterService {
  private redis: Redis;
  private monitoring: RateLimitMonitoring;
  private circuitBreaker: CircuitBreaker;
  private scriptSha: string | null = null;

  constructor(redis: Redis) {
    this.redis = redis;
    this.monitoring = new RateLimitMonitoring(redis);
    this.circuitBreaker = new CircuitBreaker(
      RATE_LIMIT_DEFAULTS.CIRCUIT_BREAKER.THRESHOLD,
      RATE_LIMIT_DEFAULTS.CIRCUIT_BREAKER.TIMEOUT
    );

    // Start cleanup interval
    setInterval(
      () => this.monitoring.cleanup(),
      RATE_LIMIT_DEFAULTS.CLEANUP_INTERVAL
    );
  }

  private async loadScript(): Promise<string> {
    const script = `
      local key = KEYS[1]
      local burstKey = KEYS[2]
      local now = tonumber(ARGV[1])
      local windowMs = tonumber(ARGV[2])
      local maxRequests = tonumber(ARGV[3])
      local cost = tonumber(ARGV[4])
      local burstMultiplier = tonumber(ARGV[5])
      local burstTtl = tonumber(ARGV[6])
      
      -- Clean up old requests
      redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
      
      -- Get current request count and burst credits
      local requestCount = redis.call('ZCARD', key)
      local burstCredits = tonumber(redis.call('GET', burstKey) or "0")
      local effectiveLimit = maxRequests
      
      -- Apply burst credits if available
      if burstCredits > 0 then
        effectiveLimit = math.min(maxRequests * burstMultiplier, maxRequests + burstCredits)
        redis.call('DECRBY', burstKey, 1)
      end
      
      -- Check if limit exceeded
      if requestCount * cost >= effectiveLimit then
        local oldestRequest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        if #oldestRequest == 0 then
          return {0, now + windowMs, requestCount, effectiveLimit}
        end
        local resetTime = tonumber(oldestRequest[2]) + windowMs
        return {0, resetTime, requestCount, effectiveLimit}
      end
      
      -- Add new request
      redis.call('ZADD', key, now, now .. '-' .. math.random())
      redis.call('EXPIRE', key, math.ceil(windowMs / 1000))
      
      -- Accumulate burst credits if under normal limit
      if requestCount * cost < maxRequests then
        redis.call('INCR', burstKey)
        redis.call('EXPIRE', burstKey, burstTtl)
      end
      
      -- Return remaining requests and reset time
      local remaining = math.max(0, effectiveLimit - (requestCount + 1) * cost)
      return {1, now + windowMs, remaining, effectiveLimit}
    `;

    try {
      return await this.redis.eval(script, [], []);
    } catch (error) {
      console.error('Failed to load rate limit script:', error);
      throw new Error(RATE_LIMIT_ERRORS.SCRIPT_LOAD);
    }
  }

  private getKeyPrefix(config: RateLimiterConfig): string {
    return `ratelimit:${config.type}:${config.identifier}`;
  }

  async checkRateLimit(
    identifier: string,
    config: RateLimiterConfig
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const key = this.getKeyPrefix(config);
    const burstKey = `${key}:burst`;

    try {
      const result = await this.circuitBreaker.execute(
        async () => {
          const [allowed, resetTime, remaining, limit] = await this.redis.eval(
            await this.loadScript(),
            [key, burstKey],
            [
              now.toString(),
              config.windowMs.toString(),
              config.maxRequests.toString(),
              (config.cost || 1).toString(),
              (config.burst?.maxBurst || RATE_LIMIT_DEFAULTS.BURST_MULTIPLIER).toString(),
              (config.burst?.burstTtl || RATE_LIMIT_DEFAULTS.BURST_TTL).toString(),
            ]
          ) as [number, number, number, number];

          const info: RateLimitInfo = {
            allowed: allowed === 1,
            remaining: Math.max(0, remaining),
            resetTime: resetTime,
            limit: limit,
          };

          // Record metrics
          await this.monitoring.recordRequest(identifier, config.type, info);

          return info;
        },
        async () => ({
          allowed: true, // Fail open
          remaining: 1,
          resetTime: now + config.windowMs,
          limit: config.maxRequests,
        })
      );

      return result;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return {
        allowed: true,
        remaining: 1,
        resetTime: now + config.windowMs,
        limit: config.maxRequests,
      };
    }
  }

  async batchCheckRateLimit(
    identifiers: string[],
    config: RateLimiterConfig
  ): Promise<Map<string, RateLimitInfo>> {
    const now = Date.now();
    const pipeline = this.redis.pipeline();
    const script = await this.loadScript();

    try {
      const results = await this.circuitBreaker.execute(
        async () => {
          // Batch all rate limit checks in a pipeline
          identifiers.forEach(identifier => {
            const key = this.getKeyPrefix({ ...config, identifier });
            const burstKey = `${key}:burst`;
            pipeline.eval(
              script,
              [key, burstKey],
              [
                now.toString(),
                config.windowMs.toString(),
                config.maxRequests.toString(),
                (config.cost || 1).toString(),
                (config.burst?.maxBurst || RATE_LIMIT_DEFAULTS.BURST_MULTIPLIER).toString(),
                (config.burst?.burstTtl || RATE_LIMIT_DEFAULTS.BURST_TTL).toString(),
              ]
            );
          });

          const pipelineResults = await pipeline.exec();
          return pipelineResults.map(result => result as [number, number, number, number]);
        },
        async () => {
          return identifiers.map(() => [1, now + config.windowMs, config.maxRequests - 1, config.maxRequests]);
        }
      );

      const rateLimitMap = new Map<string, RateLimitInfo>();

      results.forEach((result, index) => {
        const identifier = identifiers[index];
        const [allowed, resetTime, remaining, limit] = result;

        const info: RateLimitInfo = {
          allowed: allowed === 1,
          remaining: Math.max(0, remaining),
          resetTime: resetTime,
          limit: limit,
        };

        rateLimitMap.set(identifier, info);

        // Record metrics asynchronously
        this.monitoring.recordRequest(identifier, config.type, info).catch(console.error);
      });

      return rateLimitMap;
    } catch (error) {
      console.error('Batch rate limit check failed:', error);
      return new Map(
        identifiers.map(identifier => [
          identifier,
          {
            allowed: true,
            remaining: 1,
            resetTime: now + config.windowMs,
            limit: config.maxRequests,
          },
        ])
      );
    }
  }

  async clearRateLimit(identifier: string, config: RateLimiterConfig): Promise<void> {
    const key = this.getKeyPrefix({ ...config, identifier });
    const burstKey = `${key}:burst`;
    
    try {
      await this.redis.pipeline()
        .del(key)
        .del(burstKey)
        .exec();
    } catch (error) {
      console.error('Failed to clear rate limit:', error);
    }
  }

  async getRateLimitMetrics(type: string, minutes: number = 5) {
    return this.monitoring.getMetrics(type, minutes);
  }

  async getAlerts(type: string, limit: number = 100) {
    return this.monitoring.getAlerts(type, limit);
  }

  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}
