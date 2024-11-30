import { Redis } from '@upstash/redis';
import { logger } from '../utils/logger';

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error('Missing UPSTASH_REDIS_REST_URL');
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Missing UPSTASH_REDIS_REST_TOKEN');
}

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private connectionPromise: Promise<void> | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly reconnectDelay: number = 1000; // Start with 1 second

  private constructor() {
    this.client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      automaticDeserialization: true,
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private async connect(): Promise<void> {
    if (this.isConnected) return;
    
    try {
      // Test connection
      await this.client.ping();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Redis connection established');
    } catch (error) {
      this.isConnected = false;
      logger.error('Redis connection failed', { error });
      throw error;
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max Redis reconnection attempts reached');
      throw new Error('Failed to reconnect to Redis');
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info(`Attempting Redis reconnection in ${delay}ms`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    return this.connect();
  }

  private async ensureConnectionInternal(): Promise<void> {
    if (!this.connectionPromise) {
      this.connectionPromise = this.connect();
    }
    try {
      await this.connectionPromise;
    } catch (error) {
      this.connectionPromise = null;
      await this.reconnect();
    }
  }

  public async ensureConnection(): Promise<void> {
    await this.connect();
  }

  public async get<T>(key: string): Promise<T | null> {
    await this.ensureConnection();
    return this.client.get(key);
  }

  public async set(key: string, value: any, expirySeconds?: number): Promise<void> {
    try {
      await this.ensureConnectionInternal();
      const startTime = process.hrtime();
      
      if (expirySeconds) {
        await this.client.setex(key, expirySeconds, value);
      } else {
        await this.client.set(key, value);
      }
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      
      logger.debug('Redis SET operation', {
        key,
        duration,
        expiry: expirySeconds,
        success: true
      });
    } catch (error) {
      logger.error('Redis SET operation failed', {
        key,
        error
      });
      throw error;
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.ensureConnectionInternal();
      const startTime = process.hrtime();
      
      await this.client.del(key);
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      
      logger.debug('Redis DEL operation', {
        key,
        duration,
        success: true
      });
    } catch (error) {
      logger.error('Redis DEL operation failed', {
        key,
        error
      });
      throw error;
    }
  }

  public async flushAll(): Promise<void> {
    try {
      await this.ensureConnectionInternal();
      await this.client.flushall();
      logger.info('Redis cache flushed');
    } catch (error) {
      logger.error('Redis flush operation failed', { error });
      throw error;
    }
  }

  public getClient(): Redis {
    if (!this.isConnected) {
      this.connect().catch(error => {
        logger.error('Failed to connect to Redis while getting client', { error });
      });
    }
    return this.client;
  }
}

export const redis = RedisClient.getInstance();
