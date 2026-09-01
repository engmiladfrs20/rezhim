import type { AiGenerationRequest, AiGenerationResponse, AiVisionRequest } from '@nutriai/types';
import { AiProviderError } from './errors';
import type { AiProvider } from './gemini';

export interface CloudflareAiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

interface ChatResponse {
  response?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
}

function readText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object') return undefined;
  const body = value as ChatResponse;
  if (typeof body.response === 'string' && body.response.trim()) return body.response.trim();
  const choiceText = body.choices?.[0]?.message?.content;
  if (typeof choiceText === 'string' && choiceText.trim()) return choiceText.trim();
  return undefined;
}

export interface CloudflareAiProviderConfig {
  binding: CloudflareAiBinding;
  model?: string | undefined;
}

/** Server-side fallback for edge regions where Google AI Studio egress fails. */
export class CloudflareAiProvider implements AiProvider {
  private readonly binding: CloudflareAiBinding;
  private readonly model: string;

  constructor(config: CloudflareAiProviderConfig) {
    this.binding = config.binding;
    this.model = config.model?.trim() || '@cf/google/gemma-4-26b-a4b-it';
  }

  async generate(request: AiGenerationRequest): Promise<AiGenerationResponse> {
    return this.generateContent(request, request.prompt);
  }

  async generateVision(request: AiVisionRequest): Promise<AiGenerationResponse> {
    return this.generateContent(request, [
      { type: 'text', text: request.prompt },
      {
        type: 'image_url',
        image_url: { url: `data:${request.mimeType};base64,${request.imageBase64}` },
      },
    ]);
  }

  private async generateContent(
    request: AiGenerationRequest,
    content: string | Array<Record<string, unknown>>,
  ): Promise<AiGenerationResponse> {
    const messages = [
      ...(request.systemInstruction
        ? [{ role: 'system', content: request.systemInstruction }]
        : []),
      { role: 'user', content },
    ];
    let result: unknown;
    try {
      result = await this.binding.run(this.model, {
        messages,
        max_tokens: request.maxOutputTokens ?? 512,
        temperature: request.temperature ?? 0.2,
      });
    } catch (error) {
      throw new AiProviderError(
        error instanceof Error ? error.message : 'Cloudflare AI request failed.',
      );
    }
    const text = readText(result);
    if (!text) throw new AiProviderError('Cloudflare AI returned no text candidate.');
    return { provider: 'cloudflare-workers-ai', model: this.model, text };
  }
}
