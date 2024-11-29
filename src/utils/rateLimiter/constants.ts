export const RATE_LIMIT_DEFAULTS = {
  WINDOW_MS: 60 * 1000, // 1 minute
  MAX_REQUESTS: 100,
  BURST_MULTIPLIER: 2,
  BURST_TTL: 10, // seconds
  CLEANUP_INTERVAL: 60 * 1000, // 1 minute
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  CIRCUIT_BREAKER: {
    THRESHOLD: 5,
    TIMEOUT: 60 * 1000,
  },
};

export const RATE_LIMIT_TIERS = {
  FREE: {
    name: 'free',
    multiplier: 1,
    maxBurst: 2,
  },
  BASIC: {
    name: 'basic',
    multiplier: 2,
    maxBurst: 3,
  },
  PREMIUM: {
    name: 'premium',
    multiplier: 5,
    maxBurst: 5,
  },
  ENTERPRISE: {
    name: 'enterprise',
    multiplier: 10,
    maxBurst: 10,
  },
} as const;

export const RATE_LIMIT_ERRORS = {
  REDIS_CONNECTION: 'Redis connection error',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  INVALID_CONFIG: 'Invalid rate limit configuration',
  SCRIPT_LOAD: 'Failed to load Lua script',
} as const;
