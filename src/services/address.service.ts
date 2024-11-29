import { db } from '@/lib/db';
import type { Address, CreateAddressPayload, UpdateAddressPayload } from '@/types/address';
import { addressSchema, createAddressSchema, updateAddressSchema } from '@/types/address';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/errors';

export class AddressService {
  async create(userId: string, data: CreateAddressPayload): Promise<Address> {
    const validatedData = createAddressSchema.parse({ ...data, user_id: userId });
    
    try {
      // If this is set as default, unset other default addresses
      if (validatedData.is_default) {
        await db.address.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false }
        });
      }

      const address = await db.address.create({
        data: validatedData
      });

      return addressSchema.parse(address);
    } catch (error) {
      throw new DatabaseError('Failed to create address', { cause: error });
    }
  }

  async update(userId: string, addressId: string, data: UpdateAddressPayload): Promise<Address> {
    const validatedData = updateAddressSchema.parse(data);

    try {
      // Check if address exists and belongs to user
      const existingAddress = await db.address.findFirst({
        where: { id: addressId, user_id: userId }
      });

      if (!existingAddress) {
        throw new NotFoundError('Address not found');
      }

      // If setting as default, unset other default addresses
      if (validatedData.is_default) {
        await db.address.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false }
        });
      }

      const address = await db.address.update({
        where: { id: addressId },
        data: validatedData
      });

      return addressSchema.parse(address);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to update address', { cause: error });
    }
  }

  async delete(userId: string, addressId: string): Promise<void> {
    try {
      const address = await db.address.findFirst({
        where: { id: addressId, user_id: userId }
      });

      if (!address) {
        throw new NotFoundError('Address not found');
      }

      await db.address.delete({
        where: { id: addressId }
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to delete address', { cause: error });
    }
  }

  async findById(userId: string, addressId: string): Promise<Address> {
    try {
      const address = await db.address.findFirst({
        where: { id: addressId, user_id: userId }
      });

      if (!address) {
        throw new NotFoundError('Address not found');
      }

      return addressSchema.parse(address);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to find address', { cause: error });
    }
  }

  async findAll(userId: string): Promise<Address[]> {
    try {
      const addresses = await db.address.findMany({
        where: { user_id: userId },
        orderBy: [
          { is_default: 'desc' },
          { created_at: 'desc' }
        ]
      });

      return addresses.map(address => addressSchema.parse(address));
    } catch (error) {
      throw new DatabaseError('Failed to fetch addresses', { cause: error });
    }
  }

  async setDefault(userId: string, addressId: string): Promise<Address> {
    try {
      // Check if address exists and belongs to user
      const existingAddress = await db.address.findFirst({
        where: { id: addressId, user_id: userId }
      });

      if (!existingAddress) {
        throw new NotFoundError('Address not found');
      }

      // Unset other default addresses
      await db.address.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false }
      });

      // Set new default address
      const address = await db.address.update({
        where: { id: addressId },
        data: { is_default: true }
      });

      return addressSchema.parse(address);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Failed to set default address', { cause: error });
    }
  }
}
