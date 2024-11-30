import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../../integrations/prisma';
import { evaluateCondition } from './conditionEvaluator';
import { Cache } from './cache';

export interface PermissionContext {
  userId: string;
  scopeId?: string;
  scopeType?: string;
  resourceId?: string;
  attributes?: string[];
  user?: any;
  content?: any;
  context?: Record<string, any>;
}

export interface PermissionCheck {
  resource: string;
  action: string;
  attributes?: string[];
  conditions?: Record<string, any>;
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  attributes: string[];
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PermissionCondition {
  id: string;
  rolePermissionId: string;
  type: string;
  condition: any;
  createdAt: Date;
  updatedAt: Date;
}

interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  createdAt: Date;
  updatedAt: Date;
  permission: Permission;
  conditions: PermissionCondition[];
}

interface RoleCondition {
  id: string;
  roleId: string;
  type: string;
  condition: any;
  createdAt: Date;
  updatedAt: Date;
}

interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  parentRoleId?: string | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  rolePermissions: RolePermission[];
  roleConditions: RoleCondition[];
}

export class PermissionManager {
  private static instance: PermissionManager;
  private cache: Cache;

  private constructor() {
    this.cache = new Cache();
  }

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  public async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  private async getRoleHierarchy(roleId: string): Promise<string[]> {
    return this.cache.getOrSet(`role-hierarchy:${roleId}`, async () => {
      const roleIds = new Set<string>([roleId]);
      const queue = [roleId];

      while (queue.length > 0) {
        const currentRoleId = queue.shift()!;
        const role = await prisma.role.findUnique({
          where: { id: currentRoleId },
          select: { parentRoleId: true }
        });

        if (role?.parentRoleId && !roleIds.has(role.parentRoleId)) {
          roleIds.add(role.parentRoleId);
          queue.push(role.parentRoleId);
        }
      }

      return Array.from(roleIds);
    });
  }

  private async getUserRolesWithPermissions(context: PermissionContext): Promise<Role[]> {
    const cacheKey = `user-roles:${context.userId}:${context.scopeId || 'global'}:${context.scopeType || 'none'}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      const userRoles = await prisma.userRole.findMany({
        where: {
          userId: context.userId,
          scopeId: context.scopeId,
          scopeType: context.scopeType,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                  conditions: true
                }
              },
              roleConditions: true
            }
          }
        }
      });

      // Get all role IDs including parent roles
      const allRoleIds = new Set<string>();
      for (const userRole of userRoles) {
        const hierarchyIds = await this.getRoleHierarchy(userRole.role.id);
        hierarchyIds.forEach(id => allRoleIds.add(id));
      }

      // Fetch additional roles from hierarchy
      const additionalRoles = await prisma.role.findMany({
        where: {
          id: { in: Array.from(allRoleIds) }
        },
        include: {
          rolePermissions: {
            include: {
              permission: true,
              conditions: true
            }
          },
          roleConditions: true
        }
      });

      return [...userRoles.map((ur: { role: Role; }) => ur.role as Role), ...additionalRoles as Role[]];
    });
  }

  public async checkPermission(context: PermissionContext, check: PermissionCheck): Promise<boolean> {
    try {
      const roles = await this.getUserRolesWithPermissions(context);
      
      for (const role of roles) {
        // Check role conditions first
        if (role.roleConditions?.length) {
          const conditionsMet = await Promise.all(
            role.roleConditions.map(condition => 
              evaluateCondition(condition.condition, context)
            )
          );
          if (!conditionsMet.every(met => met)) continue;
        }

        // Check permissions
        const matchingPermissions = role.rolePermissions?.filter(rp => 
          this.matchesPermission(rp.permission, check)
        );

        if (matchingPermissions?.length) {
          // Check permission conditions
          for (const rp of matchingPermissions) {
            if (!rp.conditions?.length) return true;

            const conditionsMet = await Promise.all(
              rp.conditions.map(condition =>
                evaluateCondition(condition.condition, context)
              )
            );

            if (conditionsMet.every(met => met)) return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  private matchesPermission(permission: Permission, check: PermissionCheck): boolean {
    // Check for wildcard permissions
    if (permission.resource === '*' && permission.action === '*') return true;
    if (permission.resource === '*' && permission.action === check.action) return true;
    if (permission.resource === check.resource && permission.action === '*') return true;

    // Check exact match
    if (permission.resource !== check.resource || permission.action !== check.action) return false;

    // Check attributes if specified
    if (check.attributes?.length && permission.attributes) {
      const permissionAttrs = new Set(permission.attributes);
      return check.attributes.every(attr => permissionAttrs.has(attr));
    }

    return true;
  }

  public async invalidateUserCache(userId: string): Promise<void> {
    await this.cache.invalidateUserCache(userId);
  }

  public async invalidateRoleCache(roleId: string): Promise<void> {
    await this.cache.invalidateRoleCache(roleId);
  }

  public async invalidatePermissionCache(): Promise<void> {
    await this.cache.invalidatePermissionCache();
  }
}