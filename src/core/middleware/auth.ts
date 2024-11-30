import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../integrations/supabase';
import { prisma } from '../../integrations/prisma';
import { AppError, UnauthorizedError } from '../errors/errors';
import { User } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { rateLimit } from 'express-rate-limit';
import { RedisClient } from '../../integrations/redis';

// Define user roles
export enum UserRole {
  ADMIN = 'ADMIN',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
  CLIENT = 'CLIENT'
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User & { 
        role?: UserRole;
        roles?: Array<{
          id: string;
          name: UserRole;
          rolePermissions: Array<{
            id: string;
            permissionId: string;
          }>;
        }>;
        permissions?: string[];
      };
    }
  }
}

// Rate limiting configuration
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many auth attempts, please try again later' }
});

// Token blacklist cache
const tokenBlacklist = new Set<string>();

// Async function to initialize token blacklist
async function initializeTokenBlacklist() {
  try {
    const redisClient = RedisClient.getInstance();
    await redisClient.ensureConnection();
    const tokens = await redisClient.get<string[]>('blacklisted_tokens') || [];
    tokens.forEach(token => tokenBlacklist.add(token));
  } catch (error) {
    logger.error('Failed to initialize token blacklist', { error });
  }
}

// Call initialization function
initializeTokenBlacklist();

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedError('No authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Check token blacklist
    if (tokenBlacklist.has(token)) {
      throw new UnauthorizedError('Token has been revoked');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Auth failed', { error: new UnauthorizedError('Invalid token'), ip: req.ip });
      throw new UnauthorizedError('Invalid token');
    }

    // Get user from database with roles and permissions
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: true
              }
            }
          }
        }
      }
    });

    if (!dbUser) {
      const err = new UnauthorizedError('User not found');
      logger.error('User found in Supabase but not in database', { error: err, userId: user.id });
      throw err;
    }

    // Map database role to enum
    const userRoles = dbUser.userRoles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name as UserRole,
      rolePermissions: ur.role.rolePermissions.map(rp => ({
        id: rp.id,
        permissionId: rp.permissionId
      }))
    }));

    // Attach user and permissions to request
    req.user = {
      ...user,
      roles: userRoles,
      role: userRoles[0]?.name, // Set primary role
      permissions: userRoles.flatMap(ur => 
        ur.rolePermissions.map(rp => rp.permissionId)
      )
    };

    // Add request tracking for security
    logger.info('Authenticated request', {
      userId: user.id,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Authentication failed', error instanceof Error ? error : undefined));
    }
  }
};

export const blacklistToken = async (token: string): Promise<void> => {
  tokenBlacklist.add(token);
  const redisClient = await RedisClient.getInstance();
  const tokens = await redisClient.get<string[]>('blacklisted_tokens') || [];
  tokens.push(token);
  await redisClient.set('blacklisted_tokens', tokens, 24 * 60 * 60); // 24 hours
};

// Role-based middleware generators
export const requireRole = (role: UserRole) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    
    if (req.user.role !== role) {
      throw new UnauthorizedError(`Requires ${role} role`);
    }
    
    next();
  };
};

// Convenience middleware for common roles
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireServiceProvider = requireRole(UserRole.SERVICE_PROVIDER);

// Middleware to check if user is accessing their own resource
export const requireSelf = (userIdExtractor: (req: Request) => string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const resourceUserId = userIdExtractor(req);
    if (req.user.id !== resourceUserId && req.user.role !== UserRole.ADMIN) {
      throw new UnauthorizedError('Unauthorized access to resource');
    }

    next();
  };
};
