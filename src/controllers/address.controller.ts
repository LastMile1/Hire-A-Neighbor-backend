import { Request, Response } from 'express';
import { AddressService } from '@/services/address.service';
import { ValidationError } from '@/lib/errors';
import { createAddressSchema, updateAddressSchema } from '@/types/address';

const addressService = new AddressService();

export class AddressController {
  async create(req: Request, res: Response) {
    try {
      const userId = req.user.id; // Assuming auth middleware sets user
      const address = await addressService.create(userId, req.body);
      res.status(201).json(address);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async update(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;
      const address = await addressService.update(userId, addressId, req.body);
      res.json(address);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error.message === 'Address not found') {
        res.status(404).json({ error: 'Address not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;
      await addressService.delete(userId, addressId);
      res.status(204).send();
    } catch (error) {
      if (error.message === 'Address not found') {
        res.status(404).json({ error: 'Address not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;
      const address = await addressService.findById(userId, addressId);
      res.json(address);
    } catch (error) {
      if (error.message === 'Address not found') {
        res.status(404).json({ error: 'Address not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const addresses = await addressService.findAll(userId);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async setDefault(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;
      const address = await addressService.setDefault(userId, addressId);
      res.json(address);
    } catch (error) {
      if (error.message === 'Address not found') {
        res.status(404).json({ error: 'Address not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
