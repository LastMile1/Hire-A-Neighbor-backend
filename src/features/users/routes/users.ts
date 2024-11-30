import { Router } from 'express';
import { supabaseClient } from '../../../integrations/supabase';
import { AppError } from '../../../core/middleware/errorHandler';

const router = Router();

// Get user profile
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError(500, error.message));
    } else {
      next(new AppError(500, 'An unknown error occurred'));
    }
  }
});

// Update user profile
router.put('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError(500, error.message));
    } else {
      next(new AppError(500, 'An unknown error occurred'));
    }
  }
});

export default router;
