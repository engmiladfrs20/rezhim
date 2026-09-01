import type { CloudflareEnv } from '@nutriai/types';
import { GeminiProvider } from './gemini';
import type { AiProvider } from './gemini';
import { CloudflareAiProvider } from './cloudflare';
import { AiProviderError } from './errors';

export function createGeminiProvider(
  env: CloudflareEnv,
  fetcher: typeof fetch = fetch,
): GeminiProvider | null {
  if (!env.GEMINI_API_KEY) return null;
  return new GeminiProvider(
    {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      endpoint: env.GEMINI_ENDPOINT,
    },
    fetcher,
  );
}

class FallbackAiProvider implements AiProvider {
  constructor(
    private readonly primary: AiProvider,
    private readonly fallback: AiProvider,
  ) {}

  async generate(request: Parameters<AiProvider['generate']>[0]) {
    try {
      return await this.primary.generate(request);
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;
      return this.fallback.generate(request);
    }
  }

  async generateVision(request: Parameters<AiProvider['generateVision']>[0]) {
    try {
      return await this.primary.generateVision(request);
    } catch (error) {
      if (!(error instanceof AiProviderError)) throw error;
      return this.fallback.generateVision(request);
    }
  }
}

export function createAiProvider(
  env: CloudflareEnv,
  fetcher: typeof fetch = fetch,
): AiProvider | null {
  const gemini = createGeminiProvider(env, fetcher);
  // Workers AI is intentionally enabled only for deployed environments. Local
  // and test runtimes may expose an AI binding through the Vitest plugin, but
  // silently calling the remote provider there would make tests non-deterministic
  // and could incur unexpected usage charges.
  const cloudflareEnabled = env.APP_ENV === 'staging' || env.APP_ENV === 'production';
  const cloudflare =
    cloudflareEnabled && env.AI
      ? new CloudflareAiProvider({ binding: env.AI, model: env.CLOUDFLARE_AI_MODEL })
      : null;
  if (gemini && cloudflare) return new FallbackAiProvider(gemini, cloudflare);
  return gemini ?? cloudflare;
}
