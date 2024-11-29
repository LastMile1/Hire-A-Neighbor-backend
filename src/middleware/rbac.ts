import { Request, Response, NextFunction } from 'express';
import { PermissionManager, PermissionCheck } from '../utils/permissions';

export const checkPermission = (check: PermissionCheck) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const permissionManager = PermissionManager.getInstance();
      const hasPermission = await permissionManager.checkPermission(userId, check);

      if (!hasPermission) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const checkTeamPermission = (check: PermissionCheck) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const teamId = req.params.teamId || req.body.teamId;

      if (!userId || !teamId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const permissionManager = PermissionManager.getInstance();
      const hasPermission = await permissionManager.checkTeamPermission(
        userId,
        teamId,
        check
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      next();
    } catch (error) {
      console.error('Team RBAC middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const checkProjectPermission = (check: PermissionCheck) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const projectId = req.params.projectId || req.body.projectId;

      if (!userId || !projectId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const permissionManager = PermissionManager.getInstance();
      const hasPermission = await permissionManager.checkProjectPermission(
        userId,
        projectId,
        check
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      next();
    } catch (error) {
      console.error('Project RBAC middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
