import { Redis } from '@upstash/redis';
import { RateLimitInfo } from './types';

export class RateLimitMonitoring {
  private redis: Redis;
  private metricsPrefix: string = 'ratelimit:metrics:';
  private alertsPrefix: string = 'ratelimit:alerts:';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async recordRequest(
    identifier: string,
    type: string,
    info: RateLimitInfo
  ): Promise<void> {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const pipeline = this.redis.pipeline();

    // Record request count
    pipeline.hincrby(
      `${this.metricsPrefix}${type}:${minute}`,
      'total_requests',
      1
    );

    // Record blocked requests if rate limit exceeded
    if (!info.allowed) {
      pipeline.hincrby(
        `${this.metricsPrefix}${type}:${minute}`,
        'blocked_requests',
        1
      );
      
      // Record high-usage alert if remaining is low
      if (info.remaining < info.limit * 0.1) {
        await this.recordAlert(identifier, type, 'HIGH_USAGE', {
          remaining: info.remaining,
          limit: info.limit,
        });
      }
    }

    // Record unique users/IPs
    pipeline.sadd(`${this.metricsPrefix}${type}:${minute}:uniques`, identifier);

    await pipeline.exec();
  }

  async getMetrics(type: string, minutes: number = 5): Promise<{
    totalRequests: number;
    blockedRequests: number;
    uniqueIdentifiers: number;
    avgRequestsPerMinute: number;
  }> {
    const now = Math.floor(Date.now() / 60000);
    const pipeline = this.redis.pipeline();
    
    for (let i = 0; i < minutes; i++) {
      const minute = now - i;
      pipeline.hgetall(`${this.metricsPrefix}${type}:${minute}`);
      pipeline.scard(`${this.metricsPrefix}${type}:${minute}:uniques`);
    }

    const results = await pipeline.exec();
    let totalRequests = 0;
    let blockedRequests = 0;
    let uniqueIdentifiers = 0;

    for (let i = 0; i < results.length; i += 2) {
      const metrics = results[i] as Record<string, string>;
      const uniques = results[i + 1] as number;

      if (metrics) {
        totalRequests += parseInt(metrics.total_requests || '0', 10);
        blockedRequests += parseInt(metrics.blocked_requests || '0', 10);
      }
      uniqueIdentifiers += uniques;
    }

    return {
      totalRequests,
      blockedRequests,
      uniqueIdentifiers,
      avgRequestsPerMinute: totalRequests / minutes,
    };
  }

  private async recordAlert(
    identifier: string,
    type: string,
    alertType: string,
    data: Record<string, any>
  ): Promise<void> {
    const alert = {
      timestamp: Date.now(),
      identifier,
      type,
      alertType,
      data,
    };

    await this.redis.lpush(
      `${this.alertsPrefix}${type}`,
      JSON.stringify(alert)
    );
    await this.redis.ltrim(`${this.alertsPrefix}${type}`, 0, 999); // Keep last 1000 alerts
  }

  async getAlerts(type: string, limit: number = 100): Promise<any[]> {
    const alerts = await this.redis.lrange(
      `${this.alertsPrefix}${type}`,
      0,
      limit - 1
    );
    return alerts.map(alert => JSON.parse(alert));
  }

  async cleanup(retentionMinutes: number = 60): Promise<void> {
    const now = Math.floor(Date.now() / 60000);
    const pipeline = this.redis.pipeline();

    for (let i = retentionMinutes; i < retentionMinutes + 10; i++) {
      const minute = now - i;
      pipeline.del(`${this.metricsPrefix}*:${minute}`);
      pipeline.del(`${this.metricsPrefix}*:${minute}:uniques`);
    }

    await pipeline.exec();
  }
}
