import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(100),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password cannot exceed 128 characters'),
  display_name: z.string().trim().min(2, 'Display name must be at least 2 characters').max(50),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(100),
  password: z.string().min(1, 'Password is required'), // Login simply accepts minimum 1 char securely, verifying against dummy limits accurately avoiding arbitrary rule leakage.
});
export type LoginDto = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters')
      .max(50)
      .optional(),
    locale: z.enum(['fa', 'en']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided for update');
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
