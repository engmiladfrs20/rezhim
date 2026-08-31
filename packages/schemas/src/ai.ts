import { z } from 'zod';
import { diaryDateSchema } from './food';
import { localeEnum } from './food';
import { nutritionTargetsInputSchema } from './nutrition';

export const aiGenerateInputSchema = z.object({
  prompt: z.string().trim().min(1).max(12000),
  system_instruction: z.string().trim().max(4000).optional(),
  max_output_tokens: z.number().int().min(16).max(4096).default(512),
  temperature: z.number().finite().min(0).max(1).default(0.2),
});
export type AiGenerateInputDto = z.infer<typeof aiGenerateInputSchema>;

export const aiCoachInputSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  date: diaryDateSchema,
  locale: localeEnum.default('fa'),
  biometrics: nutritionTargetsInputSchema,
});
export type AiCoachInputDto = z.infer<typeof aiCoachInputSchema>;

const base64ImageSchema = z
  .string()
  .min(16, 'Image data is required.')
  .max(4_000_000, 'Image data must not exceed 3 MB.')
  .regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    'Invalid base64 image data.',
  );

export const aiFoodRecognitionInputSchema = z.object({
  image_base64: base64ImageSchema,
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  locale: localeEnum.default('fa'),
  prompt: z
    .string()
    .trim()
    .max(1000, 'Recognition prompt must not exceed 1000 characters.')
    .optional()
    .default(
      'Identify the visible foods and describe uncertainty without estimating nutrition values.',
    ),
});
export type AiFoodRecognitionInputDto = z.infer<typeof aiFoodRecognitionInputSchema>;
