import type { CloudflareEnv } from '@nutriai/types';
import { GeminiProvider } from './gemini';

export function createGeminiProvider(env: CloudflareEnv): GeminiProvider | null {
  if (!env.GEMINI_API_KEY) return null;
  return new GeminiProvider({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    endpoint: env.GEMINI_ENDPOINT,
  });
}
