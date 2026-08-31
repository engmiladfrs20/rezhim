import { z } from 'zod';

export const aiGenerateInputSchema = z.object({
  prompt: z.string().trim().min(1).max(12000),
  system_instruction: z.string().trim().max(4000).optional(),
  max_output_tokens: z.number().int().min(16).max(4096).default(512),
  temperature: z.number().finite().min(0).max(1).default(0.2),
});
export type AiGenerateInputDto = z.infer<typeof aiGenerateInputSchema>;
