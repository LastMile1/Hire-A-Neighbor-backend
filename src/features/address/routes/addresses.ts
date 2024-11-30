import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { AddressController } from '../controllers/address.controller';
import { AddressService } from '../services/address.service';
import { authenticate } from '../../../core/middleware/authenticate';
import { validate } from '../../../core/middleware/validate';
import {
  createAddressRequestSchema,
  updateAddressRequestSchema,
  addressRequestParamsSchema,
  entityQueryRequestSchema,
  addressQueryRequestSchema,
  deleteQueryRequestSchema
} from '../validation';
import { AddressRequestParams } from '../types';

const router = express.Router();
const addressService = new AddressService();
const addressController = new AddressController(addressService);

// Type-safe request handler
const typedHandler = <P>(handler: (req: Request<P>, res: Response, next: NextFunction) => Promise<void>): RequestHandler => {
  return (req, res, next) => handler(req as Request<P>, res, next);
};

/**
 * Address Routes
 * Base path: /api/v1
 */

// Apply authentication middleware to all routes
// router.use(authenticate);

// Create a new address
router.post(
  '/:entityType/:entityId/addresses',
  authenticate,
  validate('body', createAddressRequestSchema),
  validate('params', addressRequestParamsSchema),
  addressController.create.bind(addressController)
);

// Get all addresses for an entity
router.get(
  '/:entityType/:entityId/addresses',
  authenticate,
  validate('query', entityQueryRequestSchema),
  addressController.findByEntityId.bind(addressController)
);

// Get a specific address
router.get(
  '/:entityType/:entityId/addresses/:addressId',
  authenticate,
  validate('params', addressRequestParamsSchema),
  typedHandler<AddressRequestParams>(addressController.findById.bind(addressController))
);

// Update an address
router.put(
  '/:entityType/:entityId/addresses/:addressId',
  authenticate,
  validate('params', addressRequestParamsSchema),
  validate('body', updateAddressRequestSchema),
  typedHandler<AddressRequestParams>(addressController.update.bind(addressController))
);

// Delete an address
router.delete(
  '/:entityType/:entityId/addresses/:addressId',
  authenticate,
  validate('params', addressRequestParamsSchema),
  validate('query', deleteQueryRequestSchema),
  typedHandler<AddressRequestParams>(addressController.delete.bind(addressController))
);

// Set address as primary
router.post(
  '/:entityType/:entityId/addresses/:addressId/primary',
  authenticate,
  validate('params', addressRequestParamsSchema),
  typedHandler<AddressRequestParams>(addressController.setPrimary.bind(addressController))
);

// Verify an address
router.post(
  '/:entityType/:entityId/addresses/:addressId/verify',
  authenticate,
  validate('params', addressRequestParamsSchema),
  typedHandler<AddressRequestParams>(addressController.verify.bind(addressController))
);

// Error handling middleware
// router.use(addressController.handleError);

export default router;
