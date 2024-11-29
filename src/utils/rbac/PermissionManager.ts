import { Role, Permission, RolePermission, RoleCondition, UserRole } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { evaluateCondition } from './conditionEvaluator';
import { Cache } from './cache';

export interface PermissionContext {
  userId: string;
  scopeId?: string;
  scopeType?: string;
  resourceId?: string;
  attributes?: string[];
  context?: Record<string, any>;
}

export interface PermissionCheck {
  resource: string;
  action: string;
  attributes?: string[];
  conditions?: Record<string, any>;
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

  public async clearCache() {
    await this.cache.clear();
  }

  private async getRoleHierarchy(roleId: string): Promise<string[]> {
    const roleIds = new Set<string>([roleId]);
    let currentRoleId = roleId;

    while (true) {
      const role = await prisma.role.findUnique({
        where: { id: currentRoleId },
        select: { parentRoleId: true }
      });

      if (!role?.parentRoleId) break;
      roleIds.add(role.parentRoleId);
      currentRoleId = role.parentRoleId;
    }

    return Array.from(roleIds);
  }

  private async getUserRolesWithPermissions(context: PermissionContext) {
    const cacheKey = `user-roles-${context.userId}-${context.scopeId || 'global'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: context.userId,
        scopeId: context.scopeId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            },
            conditions: true
          }
        }
      }
    });

    // Get all role IDs including parent roles
    const allRoleIds = new Set<string>();
    for (const userRole of userRoles) {
      const hierarchyIds = await this.getRoleHierarchy(userRole.roleId);
      hierarchyIds.forEach(id => allRoleIds.add(id));
    }

    // Get all roles with their permissions
    const roles = await prisma.role.findMany({
      where: {
        id: { in: Array.from(allRoleIds) }
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        conditions: true
      },
      orderBy: {
        priority: 'desc'
      }
    });

    await this.cache.set(cacheKey, roles);
    return roles;
  }

  public async checkPermission(
    check: PermissionCheck,
    context: PermissionContext
  ): Promise<boolean> {
    const roles = await this.getUserRolesWithPermissions(context);

    for (const role of roles) {
      // Check role conditions
      const roleConditionsValid = await this.evaluateRoleConditions(role.conditions, context);
      if (!roleConditionsValid) continue;

      // Check permissions
      for (const rolePermission of role.permissions) {
        const permission = rolePermission.permission;

        if (permission.resource !== check.resource || permission.action !== check.action) {
          continue;
        }

        // Check permission conditions
        const permissionConditionsValid = await this.evaluatePermissionConditions(
          permission,
          rolePermission,
          context
        );
        if (!permissionConditionsValid) continue;

        // Check attributes if specified
        if (check.attributes && check.attributes.length > 0) {
          if (!rolePermission.attributes.some(attr => check.attributes?.includes(attr))) {
            continue;
          }
        }

        return true;
      }
    }

    return false;
  }

  private async evaluateRoleConditions(
    conditions: RoleCondition[],
    context: PermissionContext
  ): Promise<boolean> {
    for (const condition of conditions) {
      const isValid = await evaluateCondition(condition.type, condition.condition, context);
      if (!isValid) return false;
    }
    return true;
  }

  private async evaluatePermissionConditions(
    permission: Permission,
    rolePermission: RolePermission,
    context: PermissionContext
  ): Promise<boolean> {
    // Check permission-level conditions
    if (permission.conditions) {
      const isValid = await evaluateCondition('permission', permission.conditions, context);
      if (!isValid) return false;
    }

    // Check role-permission override conditions
    if (rolePermission.conditions) {
      const isValid = await evaluateCondition('role-permission', rolePermission.conditions, context);
      if (!isValid) return false;
    }

    return true;
  }
}
