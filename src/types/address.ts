import { z } from 'zod';

export const addressSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['home', 'work', 'billing', 'shipping']),
  address_line1: z.string().min(3).max(100),
  address_line2: z.string().nullable().optional(),
  city: z.string().min(2).max(50),
  state: z.string().length(2),
  postal_code: z.string().regex(/^[0-9]{5}(-[0-9]{4})?$/),
  country: z.string().length(2),
  is_default: z.boolean().default(false),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  mapbox_id: z.string().nullable().optional(),
  place_formatted: z.string().nullable().optional(),
  full_address: z.string().nullable().optional(),
  match_code: z.any().nullable().optional(),
  is_verified: z.boolean().default(false),
  user_id: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date()
});

export type Address = z.infer<typeof addressSchema>;

export const createAddressSchema = addressSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
});

export type CreateAddressPayload = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema.partial();
export type UpdateAddressPayload = z.infer<typeof updateAddressSchema>;
