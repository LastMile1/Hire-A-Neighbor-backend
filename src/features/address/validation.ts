import { z } from 'zod';
import { EntityType, AddressType } from './types';

// Base schema for address validation
export const addressSchema = z.object({
  id: z.string().uuid().optional(),
  
  // Entity association
  entity_type: z.nativeEnum(EntityType),
  entity_id: z.string().uuid(),
  
  // Basic address fields
  address_line1: z.string().min(1).max(100),
  address_line2: z.string().max(100).nullable().optional(),
  unit_number: z.string().max(20).nullable().optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  postal_code: z.string().min(1).max(20),
  country: z.string().length(2).default('US'),
  country_code: z.string().length(3).nullable().optional(),
  
  // Metadata
  type: z.nativeEnum(AddressType).nullable().optional(),
  label: z.string().max(50).nullable().optional(),
  is_primary: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
  
  // Geocoding
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().max(50).nullable().optional(),
  
  // External service data
  mapbox_id: z.string().max(100).nullable().optional(),
  place_formatted: z.string().max(255).nullable().optional(),
  full_address: z.string().max(255).nullable().optional(),
  match_code: z.any().nullable().optional(),
  metadata: z.any().nullable().optional(),
  
  // User association
  user_id: z.string().uuid().nullable().optional(),
  
  // Timestamps
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

// Schema for creating a new address
export const createAddressSchema = addressSchema
  .omit({ 
    id: true,
    created_at: true,
    updated_at: true,
    is_verified: true,
    match_code: true,
    metadata: true
  })
  .refine(
    (data) => {
      if (data.entity_type === EntityType.USER && !data.user_id) {
        return false;
      }
      return true;
    },
    {
      message: "user_id is required when entity_type is 'user'",
      path: ['user_id'],
    }
  );

// Schema for updating an existing address
export const updateAddressSchema = addressSchema
  .partial()
  .omit({ 
    id: true,
    entity_type: true,
    entity_id: true,
    created_at: true,
    updated_at: true 
  });

// Request validation schemas
export const createAddressRequestSchema = addressSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateAddressRequestSchema = addressSchema
  .partial()
  .omit({
    id: true,
    entity_type: true,
    entity_id: true,
    created_at: true,
    updated_at: true,
  });

// Parameter schemas
export const addressParamsSchema = z.object({
  id: z.string().uuid(),
});

export const entityParamsSchema = z.object({
  entity_type: z.nativeEnum(EntityType),
  entity_id: z.string().uuid(),
});

// Route parameter schemas
export const addressRequestParamsSchema = z.object({
  entityType: z.nativeEnum(EntityType),
  entityId: z.string().uuid(),
  addressId: z.string().uuid(),
});

// Query schemas
export const addressQuerySchema = z.object({
  entity_type: z.nativeEnum(EntityType).optional(),
  entity_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  is_primary: z.boolean().optional(),
  type: z.nativeEnum(AddressType).optional(),
});

// Query parameter schemas
export const entityQueryRequestSchema = z.object({
  entity_type: z.nativeEnum(EntityType),
  entity_id: z.string().uuid(),
});

export const addressQueryRequestSchema = z.object({
  type: z.nativeEnum(AddressType).optional(),
  is_primary: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const deleteQueryRequestSchema = z.object({
  force: z.boolean().optional().default(false),
});

// Type exports
export type AddressParams = z.infer<typeof addressParamsSchema>;
export type EntityParams = z.infer<typeof entityParamsSchema>;
export type CreateAddressRequest = z.infer<typeof createAddressSchema>;
export type UpdateAddressRequest = z.infer<typeof updateAddressSchema>;
export type AddressQuery = z.infer<typeof addressQuerySchema>;

// Validation error messages
export const ADDRESS_VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_TYPE: 'Invalid address type',
  INVALID_ENTITY: 'Invalid entity type',
  INVALID_UUID: 'Invalid ID format',
  INVALID_POSTAL: 'Invalid postal code format',
  INVALID_COUNTRY: 'Invalid country code',
  INVALID_COORDINATES: 'Invalid coordinates',
  USER_ID_REQUIRED: "user_id is required when entity_type is 'user'",
} as const;
