import { Request, Response, NextFunction } from 'express';
import { PermissionManager, PermissionCheck, PermissionContext } from '../security/rbac/PermissionManager';
import { logger } from '../utils/logger';
import { RedisClient } from '../../integrations/redis';
import { Cache } from '../security/rbac/cache';

// Initialize Redis-backed permission cache with 1 hour TTL
const permissionCache = new Cache(RedisClient.getInstance().getClient(), 3600);

// Add error handler for cache initialization
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection in RBAC cache', { error });
});

export const checkPermission = (check: PermissionCheck) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Try to get from cache first
      const cacheKey = `perm:${userId}:${check.resource}:${check.action}`;
      const cachedPermission = await permissionCache.get(cacheKey);
      
      if (cachedPermission !== null) {
        if (!cachedPermission) {
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Insufficient permissions (cached)',
            required: {
              resource: check.resource,
              action: check.action,
              attributes: check.attributes
            }
          });
        }
        next();
        return;
      }

      const context: PermissionContext = {
        userId,
        resourceId: req.params.id || req.body.id,
        attributes: check.attributes,
        context: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          headers: req.headers
        }
      };

      const permissionManager = PermissionManager.getInstance();
      const hasPermission = await permissionManager.checkPermission(context, check);

      // Cache the result
      await permissionCache.set(cacheKey, hasPermission, 300); // Cache for 5 minutes

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId,
          resource: check.resource,
          action: check.action,
          context: {
            method: req.method,
            path: req.path,
            ip: req.ip
          }
        });

        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Insufficient permissions',
          required: {
            resource: check.resource,
            action: check.action,
            attributes: check.attributes
          }
        });
      }

      // Log successful permission checks for audit
      const [seconds, nanoseconds] = process.hrtime(startTime);
      logger.info('Permission granted', {
        userId,
        resource: check.resource,
        action: check.action,
        duration: seconds * 1000 + nanoseconds / 1000000 // Convert to milliseconds
      });

      next();
    } catch (error) {
      logger.error('RBAC middleware error:', {
        error,
        userId: req.user?.id,
        resource: check.resource,
        action: check.action
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to check permissions'
      });
    }
  };
};

export const checkTeamPermission = (check: PermissionCheck) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();
    
    try {
      const userId = req.user?.id;
      const teamId = req.params.teamId || req.body.teamId;

      if (!userId || !teamId) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Authentication and team ID required'
        });
      }

      // Try to get from cache first
      const cacheKey = `perm:${userId}:${teamId}:${check.resource}:${check.action}`;
      const cachedPermission = await permissionCache.get(cacheKey);
      
      if (cachedPermission !== null) {
        if (!cachedPermission) {
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Insufficient team permissions (cached)',
            required: {
              resource: check.resource,
              action: check.action,
              attributes: check.attributes,
              teamId
            }
          });
        }
        next();
        return;
      }

      const context: PermissionContext = {
        userId,
        scopeId: teamId,
        scopeType: 'team',
        resourceId: req.params.id || req.body.id,
        attributes: check.attributes,
        context: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          headers: req.headers
        }
      };

      const permissionManager = PermissionManager.getInstance();
      const hasPermission = await permissionManager.checkPermission(context, check);

      // Cache the result
      await permissionCache.set(cacheKey, hasPermission, 300); // Cache for 5 minutes

      if (!hasPermission) {
        logger.warn('Team permission denied', {
          userId,
          teamId,
          resource: check.resource,
          action: check.action,
          context: {
            method: req.method,
            path: req.path,
            ip: req.ip
          }
        });

        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Insufficient team permissions',
          required: {
            resource: check.resource,
            action: check.action,
            attributes: check.attributes,
            teamId
          }
        });
      }

      // Log successful permission checks for audit
      const [seconds, nanoseconds] = process.hrtime(startTime);
      logger.info('Team permission granted', {
        userId,
        teamId,
        resource: check.resource,
        action: check.action,
        duration: seconds * 1000 + nanoseconds / 1000000 // Convert to milliseconds
      });

      next();
    } catch (error) {
      logger.error('Team RBAC middleware error:', {
        error,
        userId: req.user?.id,
        teamId: req.params.teamId || req.body.teamId,
        resource: check.resource,
        action: check.action
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to check team permissions'
      });
    }
  };
};

export const checkProjectPermission = (check: PermissionCheck) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();
    
    try {
      const userId = req.user?.id;
      const projectId = req.params.projectId || req.body.projectId;

      if (!userId || !projectId) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Authentication and project ID required'
        });
      }

      // Try to get from cache first
      const cacheKey = `perm:${userId}:${projectId}:${check.resource}:${check.action}`;
      const cachedPermission = await permissionCache.get(cacheKey);
      
      if (cachedPermission !== null) {
        if (!cachedPermission) {
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Insufficient project permissions (cached)',
            required: {
              resource: check.resource,
              action: check.action,
              attributes: check.attributes,
              projectId
            }
          });
        }
        next();
        return;
      }

      const context: PermissionContext = {
        userId,
        scopeId: projectId,
        scopeType: 'project',
        resourceId: req.params.id || req.body.id,
        attributes: check.attributes,
        context: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          headers: req.headers
        }
      };

      const permissionManager = PermissionManager.getInstance();
      const hasPermission = await permissionManager.checkPermission(context, check);

      // Cache the result
      await permissionCache.set(cacheKey, hasPermission, 300); // Cache for 5 minutes

      if (!hasPermission) {
        logger.warn('Project permission denied', {
          userId,
          projectId,
          resource: check.resource,
          action: check.action,
          context: {
            method: req.method,
            path: req.path,
            ip: req.ip
          }
        });

        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Insufficient project permissions',
          required: {
            resource: check.resource,
            action: check.action,
            attributes: check.attributes,
            projectId
          }
        });
      }

      // Log successful permission checks for audit
      const [seconds, nanoseconds] = process.hrtime(startTime);
      logger.info('Project permission granted', {
        userId,
        projectId,
        resource: check.resource,
        action: check.action,
        duration: seconds * 1000 + nanoseconds / 1000000 // Convert to milliseconds
      });

      next();
    } catch (error) {
      logger.error('Project RBAC middleware error:', {
        error,
        userId: req.user?.id,
        projectId: req.params.projectId || req.body.projectId,
        resource: check.resource,
        action: check.action
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to check project permissions'
      });
    }
  };
};
