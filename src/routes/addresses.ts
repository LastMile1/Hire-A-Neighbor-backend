import express, { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

// Get user addresses
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new address
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const newAddress = {
      ...req.body,
      user_id: req.user.id
    };

    const { data: address, error } = await supabase
      .from('addresses')
      .insert([newAddress])
      .select()
      .single();

    if (error) throw error;
    return res.json({ address });
  } catch (error) {
    console.error('Add address error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update address
router.patch('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data: address, error } = await supabase
      .from('addresses')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ address });
  } catch (error) {
    console.error('Update address error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete address
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    return res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
