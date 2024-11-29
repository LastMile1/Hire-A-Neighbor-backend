import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from '../utils/rateLimiter/RateLimiterService';
import { RateLimitOptions, RateLimitInfo } from '../utils/rateLimiter/types';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const rateLimiter = new RateLimiterService(redis);

const defaultOptions: Partial<RateLimitOptions> = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  cost: 1,
  skipFailedRequests: false,
  requestWasSuccessful: (_req: Request, res: Response) => res.statusCode < 400,
  handler: (req: Request, res: Response, _next: NextFunction, info: RateLimitInfo) => {
    res.status(429).json({
      error: 'Too Many Requests',
      retryAfter: Math.ceil((info.resetTime - Date.now()) / 1000),
      limit: info.limit,
      remaining: info.remaining,
      reset: new Date(info.resetTime).toISOString(),
    });
  },
};

const getKey = (req: Request, type: string): string => {
  switch (type) {
    case 'ip':
      return req.ip || req.socket.remoteAddress || 'unknown';
    case 'user':
      return req.user?.id || 'anonymous';
    case 'endpoint':
      return `${req.method}:${req.baseUrl}${req.path}`;
    default:
      return 'default';
  }
};

export const createRateLimiter = (options: RateLimitOptions) => {
  const opts = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = opts.keyGenerator?.(req) || getKey(req, opts.type);
      
      const info = await rateLimiter.checkRateLimit(key, {
        type: opts.type,
        identifier: key,
        maxRequests: opts.maxRequests,
        windowMs: opts.windowMs,
        cost: opts.cost,
        tier: opts.tier,
      });

      // Add rate limit info to response headers
      res.setHeader('X-RateLimit-Limit', info.limit.toString());
      res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000).toString());

      if (!info.allowed) {
        return opts.handler!(req, res, next, info);
      }

      // Handle failed requests if enabled
      if (opts.skipFailedRequests) {
        const originalEnd = res.end;
        res.end = function(...args: any[]): any {
          if (opts.requestWasSuccessful!(req, res)) {
            // Do nothing, the request was already counted
          } else {
            // Refund the request cost
            rateLimiter.clearRateLimit(key, {
              type: opts.type,
              identifier: key,
              maxRequests: opts.maxRequests,
              windowMs: opts.windowMs,
            }).catch(console.error);
          }
          return originalEnd.apply(res, args);
        };
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next(error);
    }
  };
};

// Preset rate limiters
export const globalRateLimiter = createRateLimiter({
  type: 'ip',
  maxRequests: 1000,
  windowMs: 60 * 1000, // 1 minute
});

export const authRateLimiter = createRateLimiter({
  type: 'ip',
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipFailedRequests: true,
});

export const apiRateLimiter = createRateLimiter({
  type: 'user',
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  tier: {
    name: 'standard',
    multiplier: 1,
  },
});
