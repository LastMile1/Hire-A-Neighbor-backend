export interface RateLimiterConfig {
  type: 'ip' | 'user' | 'endpoint' | 'custom';
  identifier: string;
  maxRequests: number;
  windowMs: number;
  cost?: number;
  burst?: {
    enabled: boolean;
    maxBurst: number;
    burstTtl: number;
  };
  tier?: {
    name: string;
    multiplier: number;
  };
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

export interface RateLimitOptions {
  type: 'ip' | 'user' | 'endpoint' | 'custom';
  maxRequests: number;
  windowMs: number;
  cost?: number;
  keyGenerator?: (req: any) => string;
  handler?: (req: any, res: any, next: any, info: RateLimitInfo) => void;
  skipFailedRequests?: boolean;
  requestWasSuccessful?: (req: any, res: any) => boolean;
  tier?: {
    name: string;
    multiplier: number;
  };
}
