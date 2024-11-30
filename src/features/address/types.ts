import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { addressSchema } from './validation';

/**
 * Type definitions for address-related constants
 */
export const EntityType = {
  USER: 'user',
  BUSINESS: 'business',
  EVENT: 'event',
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const AddressType = {
  BILLING: 'billing',
  SHIPPING: 'shipping',
  HOME: 'home',
  WORK: 'work',
  OTHER: 'other',
} as const;

export type AddressType = (typeof AddressType)[keyof typeof AddressType];

/**
 * Core address interface
 */
export interface Address {
  id: string;
  type: string;
  user_id: string;
  address_line1: string;
  address_line2?: string | null;
  unit_number?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  country_code?: string | null;
  label?: string | null;
  is_default: boolean;
  is_verified: boolean;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  mapbox_id?: string | null;
  place_formatted?: string | null;
  full_address?: string | null;
  match_code?: any | null;
  metadata?: any | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Request/Response DTOs
 */
export interface AddressRequestParams {
  entityType: string;
  entityId: string;
  addressId: string;
}

export type CreateAddressRequest = Omit<Address, 'id' | 'created_at' | 'updated_at'>;
export interface UpdateAddressRequest extends Partial<Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {}

// Zod validation schemas
export const EntityQueryRequestSchema = z.object({
  entity_type: z.nativeEnum(EntityType),
  entity_id: z.string().uuid()
});

export const AddressQueryRequestSchema = z.object({
  type: z.nativeEnum(AddressType).optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional()
});

export const DeleteQueryRequestSchema = z.object({
  force: z.boolean().optional().default(false)
});

// Zod schema types
export type EntityQueryRequest = z.infer<typeof EntityQueryRequestSchema>;
export type AddressQueryRequest = z.infer<typeof AddressQueryRequestSchema>;
export type DeleteQueryRequest = z.infer<typeof DeleteQueryRequestSchema>;

/**
 * Database types
 */
export type AddressWhereInput = Prisma.AddressWhereInput;
export type AddressWhereUniqueInput = Prisma.AddressWhereUniqueInput;
export type AddressCreateInput = Prisma.AddressCreateInput;
export type AddressUpdateInput = Prisma.AddressUpdateInput;
export type AddressSelect = Prisma.AddressSelect;

/**
 * Error types
 */
export class AddressNotFoundError extends Error {
  constructor(addressId: string) {
    super(`Address with ID ${addressId} not found`);
    this.name = 'AddressNotFoundError';
  }
}

export class AddressValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddressValidationError';
  }
}

export class UnauthorizedAddressAccessError extends Error {
  constructor(addressId: string) {
    super(`Unauthorized access to address ${addressId}`);
    this.name = 'UnauthorizedAddressAccessError';
  }
}

/**
 * Geocoding types
 */
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  place_formatted: string;
  full_address: string;
  mapbox_id?: string;
  match_code?: string;
  timezone?: string;
  metadata?: any;
}
