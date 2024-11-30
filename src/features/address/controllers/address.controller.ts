import { Request, Response, NextFunction } from 'express';
import { AddressService } from '../services/address.service';
import {
  AddressRequestParams,
  CreateAddressRequest,
  UpdateAddressRequest,
  EntityQueryRequestSchema,
  AddressQueryRequestSchema,
  DeleteQueryRequestSchema,
  EntityQueryRequest,
  AddressQueryRequest,
  DeleteQueryRequest
} from '../types';
import { AddressNotFoundError, UnauthorizedAddressAccessError } from '../types';

export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const address = await this.addressService.create(req.body as CreateAddressRequest);
      res.status(201).json(address);
    } catch (error) {
      next(error);
    }
  }

  async findByEntityId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entity_type, entity_id } = req.query as unknown as EntityQueryRequest;
      const addresses = await this.addressService.findByEntity(entity_type, entity_id);
      res.json(addresses);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request<AddressRequestParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addressId } = req.params;
      const address = await this.addressService.findById(addressId);
      res.json(address);
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async update(req: Request<AddressRequestParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addressId } = req.params;
      const address = await this.addressService.update(addressId, req.body as UpdateAddressRequest);
      res.json(address);
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof UnauthorizedAddressAccessError) {
        res.status(403).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async delete(req: Request<AddressRequestParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addressId } = req.params;
      const { force } = req.query as unknown as DeleteQueryRequest;
      await this.addressService.delete(addressId, force);
      res.sendStatus(204);
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof UnauthorizedAddressAccessError) {
        res.status(403).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async setPrimary(req: Request<AddressRequestParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addressId } = req.params;
      const address = await this.addressService.setPrimary(addressId);
      res.json(address);
    } catch (error) {
      next(error);
    }
  }

  async verify(req: Request<AddressRequestParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addressId } = req.params;
      const address = await this.addressService.verify(addressId);
      res.json(address);
    } catch (error) {
      next(error);
    }
  }
}
