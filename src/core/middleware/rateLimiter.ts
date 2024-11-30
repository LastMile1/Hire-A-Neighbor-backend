import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from '../utils/rateLimiter/RateLimiterService';
import { RateLimitOptions, RateLimitInfo } from '../utils/rateLimiter/types';
import { Redis } from '@upstash/redis';
import { config } from '../config';

// Initialize Redis with required configuration
const redis = new Redis({
  url: config.redis.url,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  agent: undefined,
  keepAlive: true
});

const rateLimiter = new RateLimiterService(redis);

const defaultOptions: Partial<RateLimitOptions> = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  cost: 1,
  skipFailedRequests: false,
  requestWasSuccessful: (_req: Request, res: Response) => res.statusCode < 400,
  handler: (req: Request, res: Response, _next: NextFunction, info: RateLimitInfo) => {
    const resetTime = new Date(info.resetTime).getTime();
    const now = Date.now();
    res.status(429).json({
      error: 'Too Many Requests',
      resetIn: Math.ceil((resetTime - now) / 1000),
      limit: info.limit,
      remaining: info.remaining
    });
  }
};

const getKey = (req: Request, type: string): string => {
  switch (type) {
    case 'ip':
      return req.ip || req.socket.remoteAddress || 'unknown';
    case 'user':
      return req.user?.id || 'anonymous';
    case 'bearer':
      return req.headers.authorization || 'anonymous';
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
        cost: opts.cost
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
              windowMs: opts.windowMs
            }).catch(console.error);
          }
          return originalEnd.apply(res, args.length >= 2 ? [args[0], args[1], args[2]] : [null, 'utf8']);
        };
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next(error);
    }
  };
};

// Export preset rate limiters with different configurations
export const globalRateLimiter = createRateLimiter({
  type: 'ip',
  maxRequests: config.security.rateLimiter.max,
  windowMs: config.security.rateLimiter.windowMs,
});

export const authRateLimiter = createRateLimiter({
  type: 'ip',
  maxRequests: 20,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipFailedRequests: true,
});

export const apiRateLimiter = createRateLimiter({
  type: 'user',
  maxRequests: 1000,
  windowMs: 60 * 60 * 1000, // 1 hour
});
