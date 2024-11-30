import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_KEY: z.string(),
  MAPBOX_TOKEN: z.string(),
  FRONTEND_URL: z.string().default('http://localhost:3001'),
});

const envVars = envSchema.parse(process.env);

export const config = {
  env: envVars.NODE_ENV,
  port: parseInt(envVars.PORT, 10),
  database: {
    url: envVars.DATABASE_URL,
  },
  redis: {
    url: envVars.REDIS_URL,
  },
  supabase: {
    url: envVars.SUPABASE_URL,
    key: envVars.SUPABASE_KEY,
  },
  mapbox: {
    token: envVars.MAPBOX_TOKEN,
  },
  cors: {
    origin: envVars.FRONTEND_URL,
    credentials: true,
  },
  security: {
    rateLimiter: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    },
  },
} as const;
