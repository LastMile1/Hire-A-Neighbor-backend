import express, { Request, Response, NextFunction } from 'express';
import { supabaseAuth } from '../../../integrations/supabase';
import { prisma } from '../../../integrations/prisma';
import { authenticate } from '../../../core/middleware/auth';
import { AppError } from '../../../core/errors/errors';
import { UserRole } from '../../../core/middleware/auth';

const router = express.Router();

// Sign up
router.post('/signup', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role = UserRole.USER } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      throw new AppError(400, 'Missing required fields');
    }

    // Create user in Supabase
    const { user, error: authError } = await supabaseAuth.signUp(email, password);
    if (authError) throw authError;
    if (!user) throw new AppError(500, 'Failed to create user');

    // Create user in database
    const dbUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email!,
        firstName,
        lastName,
        role,
      },
    });

    res.status(201).json({ user: dbUser });
  } catch (error) {
    next(error);
  }
});

// Sign in
router.post('/signin', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'Email and password are required');
    }

    const { user, error: authError } = await supabaseAuth.signIn(email, password);
    if (authError) throw authError;
    if (!user) throw new AppError(401, 'Invalid credentials');

    // Get user from database with role
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!dbUser) {
      throw new AppError(404, 'User not found in database');
    }

    res.json({ user: dbUser });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!dbUser) {
      throw new AppError(404, 'User not found in database');
    }

    res.json({ user: dbUser });
  } catch (error) {
    next(error);
  }
});

// Logout user
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }
    
    const { error } = await supabaseAuth.signOut(req.user.id);
    if (error) throw error;
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
