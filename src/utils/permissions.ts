import { Permission, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type Resource = 'users' | 'teams' | 'projects' | 'roles' | 'permissions';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';

export interface PermissionCheck {
  resource: Resource;
  action: Action;
  attributes?: string[];
}

export class PermissionManager {
  private static instance: PermissionManager;
  private permissionCache: Map<string, Permission[]> = new Map();

  private constructor() {}

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  public async clearCache() {
    this.permissionCache.clear();
  }

  public async getUserPermissions(userId: string): Promise<Permission[]> {
    const cacheKey = `user-${userId}`;
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    const userRoles = await prisma.userRole.findMany({
      where: { user_id: userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    const permissions = userRoles.flatMap(ur => ur.role.permissions);
    this.permissionCache.set(cacheKey, permissions);
    return permissions;
  }

  public async checkPermission(
    userId: string,
    check: PermissionCheck
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    return permissions.some(permission => {
      // Check if permission matches resource and action
      if (permission.resource !== check.resource || permission.action !== check.action) {
        return false;
      }

      // If attributes are specified, check if all required attributes are present
      if (check.attributes && check.attributes.length > 0) {
        return check.attributes.every(attr => 
          permission.attributes.includes(attr)
        );
      }

      return true;
    });
  }

  public async checkTeamPermission(
    userId: string,
    teamId: string,
    check: PermissionCheck
  ): Promise<boolean> {
    const teamRole = await prisma.teamRole.findFirst({
      where: { user_id: userId, team_id: teamId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!teamRole) return false;

    return teamRole.role.permissions.some(permission => {
      if (permission.resource !== check.resource || permission.action !== check.action) {
        return false;
      }

      if (check.attributes && check.attributes.length > 0) {
        return check.attributes.every(attr => 
          permission.attributes.includes(attr)
        );
      }

      return true;
    });
  }

  public async checkProjectPermission(
    userId: string,
    projectId: string,
    check: PermissionCheck
  ): Promise<boolean> {
    const projectRole = await prisma.projectRole.findFirst({
      where: { user_id: userId, project_id: projectId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!projectRole) return false;

    return projectRole.role.permissions.some(permission => {
      if (permission.resource !== check.resource || permission.action !== check.action) {
        return false;
      }

      if (check.attributes && check.attributes.length > 0) {
        return check.attributes.every(attr => 
          permission.attributes.includes(attr)
        );
      }

      return true;
    });
  }
}
