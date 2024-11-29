import express, { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

// Get current user
router.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    return res.json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign out
router.post('/logout', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.auth.admin.signOut(req.user.id);
    
    if (error) throw error;
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
