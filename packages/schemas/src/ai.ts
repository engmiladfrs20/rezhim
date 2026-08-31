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
