import { z } from 'zod';
import { rfc3339TimestampSchema } from './food';

export const pantryLocationEnum = z.enum(['pantry', 'fridge', 'freezer']);
export const shoppingListStatusEnum = z.enum(['planned', 'purchased']);

const gramsSchema = z
  .number()
  .finite('Quantity must be finite')
  .positive('Quantity must be greater than zero')
  .max(1_000_000, 'Quantity is too large');

export const pantryCreateSchema = z.object({
  food_id: z.string({ required_error: 'food_id is required' }).trim().min(1),
  location: pantryLocationEnum.default('pantry'),
  quantity_grams: gramsSchema,
  expires_at: rfc3339TimestampSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const pantryUpdateSchema = z
  .object({
    food_id: z.string().trim().min(1).optional(),
    location: pantryLocationEnum.optional(),
    quantity_grams: gramsSchema.optional(),
    expires_at: rfc3339TimestampSchema.nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one pantry field is required');

export const pantryListQuerySchema = z.object({ location: pantryLocationEnum.optional() });

export const shoppingListCreateSchema = z.object({
  food_id: z.string({ required_error: 'food_id is required' }).trim().min(1),
  required_grams: gramsSchema,
  purchased_grams: z.number().finite().min(0).max(1_000_000).default(0),
  status: shoppingListStatusEnum.default('planned'),
  note: z.string().trim().max(500).nullable().optional(),
});

export const shoppingListUpdateSchema = z
  .object({
    food_id: z.string().trim().min(1).optional(),
    required_grams: gramsSchema.optional(),
    purchased_grams: z.number().finite().min(0).max(1_000_000).optional(),
    status: shoppingListStatusEnum.optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one shopping-list field is required');

export const shoppingListQuerySchema = z.object({ status: shoppingListStatusEnum.optional() });

export type PantryCreateInputDto = z.infer<typeof pantryCreateSchema>;
export type PantryUpdateInputDto = z.infer<typeof pantryUpdateSchema>;
export type PantryListQueryDto = z.infer<typeof pantryListQuerySchema>;
export type ShoppingListCreateInputDto = z.infer<typeof shoppingListCreateSchema>;
export type ShoppingListUpdateInputDto = z.infer<typeof shoppingListUpdateSchema>;
export type ShoppingListQueryDto = z.infer<typeof shoppingListQuerySchema>;
