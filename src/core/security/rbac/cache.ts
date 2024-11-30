import NodeCache from 'node-cache';
import { Redis } from '@upstash/redis';
import { logger } from '../../../utils/logger';

export class Cache {
  private cache: NodeCache;
  private redisClient?: Redis;
  private readonly DEFAULT_TTL = 1800; // 30 minutes

  constructor(redisOrTTL?: Redis | number, ttl: number = 1800) {
    this.cache = new NodeCache({
      stdTTL: typeof redisOrTTL === 'number' ? redisOrTTL : ttl,
      checkperiod: ttl * 0.2,
      useClones: false,
    });

    if (redisOrTTL instanceof Redis) {
      this.redisClient = redisOrTTL;
    }
  }

  public async get<T>(key: string): Promise<T | undefined> {
    try {
      // Try Redis first if available
      if (this.redisClient) {
        const value = await this.redisClient.get<T>(key);
        if (value !== null) {
          return value;
        }
      }
      
      // Fallback to local cache
      return this.cache.get<T>(key);
    } catch (error) {
      logger.error('Cache get error', { error, key });
      // Fallback to local cache on Redis error
      return this.cache.get<T>(key);
    }
  }

  public async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    try {
      // Set in Redis if available
      if (this.redisClient) {
        await this.redisClient.set(key, value, { ex: ttl });
      }
      
      // Always set in local cache as backup
      return this.cache.set(key, value, ttl);
    } catch (error) {
      logger.error('Cache set error', { error, key });
      // Fallback to local cache on Redis error
      return this.cache.set(key, value, ttl);
    }
  }

  public async delete(key: string): Promise<number> {
    try {
      if (this.redisClient) {
        await this.redisClient.del(key);
      }
      return this.cache.del(key);
    } catch (error) {
      logger.error('Cache delete error', { error, key });
      return this.cache.del(key);
    }
  }

  public async clear(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.flushall();
      }
      this.cache.flushAll();
    } catch (error) {
      logger.error('Cache clear error', { error });
      this.cache.flushAll();
    }
  }

  public async getOrSet<T>(
    key: string,
    getter: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await getter();
    await this.set(key, value, ttl);
    return value;
  }

  // Helper methods for RBAC-specific caching
  public async getUserRoles(userId: string, scopeId?: string, scopeType?: string): Promise<any | undefined> {
    const key = `user-roles:${userId}:${scopeId || 'global'}:${scopeType || 'none'}`;
    return this.get(key);
  }

  public async setUserRoles(
    userId: string,
    roles: any,
    scopeId?: string,
    scopeType?: string,
    ttl: number = this.DEFAULT_TTL
  ): Promise<boolean> {
    const key = `user-roles:${userId}:${scopeId || 'global'}:${scopeType || 'none'}`;
    return this.set(key, roles, ttl);
  }

  public async getRoleHierarchy(roleId: string): Promise<string[]> {
    const key = `role-hierarchy:${roleId}`;
    const result = await this.get<string[]>(key);
    return result || [];
  }

  public async setRoleHierarchy(
    roleId: string,
    hierarchy: string[],
    ttl: number = this.DEFAULT_TTL
  ): Promise<boolean> {
    const key = `role-hierarchy:${roleId}`;
    return this.set(key, hierarchy, ttl);
  }

  public async getPermissions(roleIds: string[]): Promise<any[]> {
    const key = `permissions:${roleIds.sort().join(',')}`;
    const result = await this.get<any[]>(key);
    return result || [];
  }

  public async setPermissions(
    roleIds: string[],
    permissions: any[],
    ttl: number = this.DEFAULT_TTL
  ): Promise<boolean> {
    const key = `permissions:${roleIds.sort().join(',')}`;
    return this.set(key, permissions, ttl);
  }

  public async invalidateUserCache(userId: string): Promise<void> {
    const keys: string[] = this.cache.keys().filter(key => key.startsWith(`user-roles:${userId}:`));
    keys.forEach(key => this.cache.del(key));
  }

  public async invalidateRoleCache(roleId: string): Promise<void> {
    const keys: string[] = this.cache.keys().filter(key => 
      key.startsWith('role-hierarchy:') || 
      key.includes(`:${roleId}:`) ||
      key.includes(`,${roleId},`) ||
      key.endsWith(`,${roleId}`)
    );
    keys.forEach(key => this.cache.del(key));
  }

  public async invalidatePermissionCache(): Promise<void> {
    const keys: string[] = this.cache.keys().filter(key => key.startsWith('permissions:'));
    keys.forEach(key => this.cache.del(key));
  }
}
