import type { AiGenerationRequest, AiGenerationResponse, AiVisionRequest } from '@nutriai/types';
import { AiProviderError } from './errors';
import type { AiProvider } from './gemini';

export interface CloudflareAiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

/**
 * Workers AI has returned a few compatible response envelopes over time. The
 * binding normally returns `{ response: string }`, while OpenAI-compatible
 * routes return `choices[0].message.content`. Some model/runtime versions wrap
 * either shape in `result`, or expose multimodal content as an array. Keep the
 * extraction tolerant of those envelopes without treating arbitrary provider
 * metadata (for example an error message) as generated text.
 */
function readText(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value == null) return undefined;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = readText(item, depth + 1);
      if (text) return text;
    }
    return undefined;
  }
  if (typeof value !== 'object') return undefined;

  const body = value as Record<string, unknown>;
  const choices = body.choices;
  const choiceItems = Array.isArray(choices)
    ? choices
    : choices && typeof choices === 'object'
      ? Object.values(choices)
      : [];
  if (choiceItems.length > 0) {
    for (const choice of choiceItems) {
      if (!choice || typeof choice !== 'object') continue;
      const choiceBody = choice as Record<string, unknown>;
      const messageText = readText(choiceBody.message, depth + 1);
      if (messageText) return messageText;
      const choiceText = readText(choiceBody.text, depth + 1);
      if (choiceText) return choiceText;
      const deltaText = readText(choiceBody.delta, depth + 1);
      if (deltaText) return deltaText;
    }
  }

  for (const key of [
    'response',
    'result',
    'output',
    'output_text',
    'generated_text',
    'reasoning_content',
    'text',
    'content',
  ]) {
    const text = readText(body[key], depth + 1);
    if (text) return text;
  }
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
