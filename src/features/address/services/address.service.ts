import { prisma } from '../../../integrations/prisma';
import { geocodeAddress, GeocodingResult } from '../../../integrations/mapbox';
import {
  Address,
  EntityType,
  AddressType,
  CreateAddressRequest,
  UpdateAddressRequest,
  AddressWhereInput,
  AddressWhereUniqueInput,
  AddressNotFoundError,
  AddressValidationError,
  UnauthorizedAddressAccessError,
} from '../types';
import { DatabaseError } from '../../../core/errors/errors';
import { Prisma } from '@prisma/client';

/**
 * Service layer for handling address-related operations
 */
export class AddressService {
  /**
   * Verify if an address belongs to the specified entity
   * @throws {UnauthorizedAddressAccessError} If address doesn't belong to the entity
   */
  async verifyAddressOwnership(
    addressId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<void> {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
      select: {
        id: true,
        type: true,
        user_id: true,
      },
    });

    if (!address) {
      throw new AddressNotFoundError(addressId);
    }

    if (address.type !== entityType || address.user_id !== entityId) {
      throw new UnauthorizedAddressAccessError(addressId);
    }
  }

  /**
   * Find addresses by entity
   */
  async findByEntity(type: string, id: string): Promise<Address[]> {
    try {
      const addresses = await prisma.address.findMany({
        where: {
          type,
          user_id: id,
          is_active: true
        } as Prisma.AddressWhereInput,
        select: {
          id: true,
          type: true,
          user_id: true,
          address_line1: true,
          address_line2: true,
          unit_number: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
          country_code: true,
          label: true,
          is_default: true,
          is_verified: true,
          is_active: true,
          latitude: true,
          longitude: true,
          timezone: true,
          mapbox_id: true,
          place_formatted: true,
          full_address: true,
          match_code: true,
          created_at: true,
          updated_at: true
        } as Prisma.AddressSelect
      }) as Address[];

      return addresses;
    } catch (error) {
      throw new DatabaseError('Failed to find addresses', error as Error);
    }
  }

  /**
   * Find an address by ID
   */
  async findById(id: string): Promise<Address> {
    try {
      const address = await prisma.address.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          user_id: true,
          address_line1: true,
          address_line2: true,
          unit_number: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
          country_code: true,
          label: true,
          is_default: true,
          is_verified: true,
          is_active: true,
          latitude: true,
          longitude: true,
          timezone: true,
          mapbox_id: true,
          place_formatted: true,
          full_address: true,
          match_code: true,
          metadata: true,
          created_at: true,
          updated_at: true
        }
      });

      if (!address) {
        throw new AddressNotFoundError(id);
      }

      return address as Address;
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to find address', error as Error);
    }
  }

  /**
   * Create a new address
   */
  async create(data: CreateAddressRequest): Promise<Address> {
    try {
      const geoResult = await this.geocodeAddress({
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: data.country
      });

      const address = await prisma.address.create({
        data: {
          ...data,
          is_active: true,
          latitude: geoResult?.latitude,
          longitude: geoResult?.longitude,
          timezone: geoResult?.timezone,
          mapbox_id: geoResult?.mapbox_id,
          place_formatted: geoResult?.place_formatted,
          full_address: geoResult?.full_address,
          match_code: geoResult?.match_code,
          metadata: geoResult?.metadata
        },
        select: {
          id: true,
          type: true,
          user_id: true,
          address_line1: true,
          address_line2: true,
          unit_number: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
          country_code: true,
          label: true,
          is_default: true,
          is_verified: true,
          is_active: true,
          latitude: true,
          longitude: true,
          timezone: true,
          mapbox_id: true,
          place_formatted: true,
          full_address: true,
          match_code: true,
          metadata: true,
          created_at: true,
          updated_at: true
        }
      }) as Address;

      return address;
    } catch (error) {
      throw new DatabaseError('Failed to create address', error as Error);
    }
  }

  /**
   * Geocode an address
   */
  private async geocodeAddress(address: {
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }): Promise<GeocodingResult | null> {
    const addressString = [
      address.address_line1,
      address.address_line2,
      address.city,
      address.state,
      address.postal_code,
      address.country
    ].filter(Boolean).join(', ');

    return geocodeAddress(addressString);
  }

  /**
   * Update an address
   */
  async update(id: string, data: UpdateAddressRequest): Promise<Address> {
    try {
      const address = await this.findById(id);
      let geoResult: GeocodingResult | null = null;

      // Only geocode if address fields have changed
      if (
        data.address_line1 ||
        data.address_line2 ||
        data.city ||
        data.state ||
        data.postal_code ||
        data.country
      ) {
        geoResult = await this.geocodeAddress({
          address_line1: data.address_line1 || address.address_line1,
          address_line2: data.address_line2 || address.address_line2,
          city: data.city || address.city,
          state: data.state || address.state,
          postal_code: data.postal_code || address.postal_code,
          country: data.country || address.country
        });
      }

      const updatedAddress = await prisma.address.update({
        where: { id },
        data: {
          ...data,
          ...(geoResult && {
            latitude: geoResult.latitude,
            longitude: geoResult.longitude,
            timezone: geoResult.timezone,
            mapbox_id: geoResult.mapbox_id,
            place_formatted: geoResult.place_formatted,
            full_address: geoResult.full_address,
            match_code: geoResult.match_code
          })
        },
        select: {
          id: true,
          type: true,
          user_id: true,
          address_line1: true,
          address_line2: true,
          unit_number: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
          country_code: true,
          label: true,
          is_default: true,
          is_verified: true,
          is_active: true,
          latitude: true,
          longitude: true,
          timezone: true,
          mapbox_id: true,
          place_formatted: true,
          full_address: true,
          match_code: true,
          metadata: true,
          created_at: true,
          updated_at: true
        }
      }) as Address;

      return updatedAddress;
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update address', error as Error);
    }
  }

  /**
   * Delete an address
   */
  async delete(id: string, force = false): Promise<Address> {
    try {
      if (force) {
        const address = await prisma.address.delete({
          where: { id },
          select: {
            id: true,
            type: true,
            user_id: true,
            address_line1: true,
            address_line2: true,
            unit_number: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
            country_code: true,
            label: true,
            is_default: true,
            is_verified: true,
            is_active: true,
            latitude: true,
            longitude: true,
            timezone: true,
            mapbox_id: true,
            place_formatted: true,
            full_address: true,
            match_code: true,
            metadata: true,
            created_at: true,
            updated_at: true
          }
        }) as Address;
        return address;
      } else {
        const address = await prisma.address.update({
          where: { id },
          data: { is_active: false },
          select: {
            id: true,
            type: true,
            user_id: true,
            address_line1: true,
            address_line2: true,
            unit_number: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
            country_code: true,
            label: true,
            is_default: true,
            is_verified: true,
            is_active: true,
            latitude: true,
            longitude: true,
            timezone: true,
            mapbox_id: true,
            place_formatted: true,
            full_address: true,
            match_code: true,
            metadata: true,
            created_at: true,
            updated_at: true
          }
        }) as Address;
        return address;
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new AddressNotFoundError(id);
        }
      }
      throw new DatabaseError('Failed to delete address', error as Error);
    }
  }

  /**
   * Sets an address as the default for its type
   */
  async setPrimary(addressId: string): Promise<Address> {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
      select: {
        id: true,
        type: true,
        user_id: true,
      },
    });

    if (!address) {
      throw new AddressNotFoundError(addressId);
    }

    // Reset all other addresses of same type to non-default
    await prisma.address.updateMany({
      where: {
        type: address.type,
        user_id: address.user_id,
        is_active: true,
      },
      data: {
        is_default: false,
      },
    });

    // Set this address as default
    return prisma.address.update({
      where: { id: addressId },
      data: {
        is_default: true,
      },
      select: {
        id: true,
        type: true,
        user_id: true,
        address_line1: true,
        address_line2: true,
        unit_number: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
        country_code: true,
        label: true,
        is_default: true,
        is_verified: true,
        is_active: true,
        latitude: true,
        longitude: true,
        timezone: true,
        mapbox_id: true,
        place_formatted: true,
        full_address: true,
        match_code: true,
        metadata: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  /**
   * Marks an address as verified
   */
  async verify(addressId: string): Promise<Address> {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
      select: {
        id: true,
      },
    });

    if (!address) {
      throw new AddressNotFoundError(addressId);
    }

    return prisma.address.update({
      where: { id: addressId },
      data: {
        is_verified: true,
      },
      select: {
        id: true,
        type: true,
        user_id: true,
        address_line1: true,
        address_line2: true,
        unit_number: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
        country_code: true,
        label: true,
        is_default: true,
        is_verified: true,
        is_active: true,
        latitude: true,
        longitude: true,
        timezone: true,
        mapbox_id: true,
        place_formatted: true,
        full_address: true,
        match_code: true,
        metadata: true,
        created_at: true,
        updated_at: true,
      },
    });
  }
}
