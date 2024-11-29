import { Router } from 'express';
import { AddressController } from '@/controllers/address.controller';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validate';
import { createAddressSchema, updateAddressSchema } from '@/types/address';

const router = Router();
const addressController = new AddressController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Create address
router.post(
  '/',
  validateRequest({ body: createAddressSchema }),
  addressController.create
);

// Update address
router.patch(
  '/:addressId',
  validateRequest({ body: updateAddressSchema }),
  addressController.update
);

// Delete address
router.delete('/:addressId', addressController.delete);

// Get address by ID
router.get('/:addressId', addressController.findById);

// Get all addresses
router.get('/', addressController.findAll);

// Set default address
router.post('/:addressId/default', addressController.setDefault);

export default router;
