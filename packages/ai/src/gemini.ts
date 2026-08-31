import type { AiGenerationRequest, AiGenerationResponse } from '@nutriai/types';
import { AiProviderError, AiUnavailableError } from './errors';

export interface AiProvider {
  generate(request: AiGenerationRequest): Promise<AiGenerationResponse>;
}

export interface GeminiProviderConfig {
  apiKey: string;
  model?: string | undefined;
  endpoint?: string | undefined;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
}

function isGeminiResponse(value: unknown): value is GeminiResponse {
  return typeof value === 'object' && value !== null;
}

function validateRequest(request: AiGenerationRequest): void {
  if (!request || typeof request.prompt !== 'string' || request.prompt.trim().length === 0) {
    throw new AiProviderError('AI prompt must be a non-empty string.');
  }
  if (request.prompt.length > 12000) {
    throw new AiProviderError('AI prompt exceeds the 12000 character safety limit.');
  }
  if (request.systemInstruction && request.systemInstruction.length > 4000) {
    throw new AiProviderError('AI system instruction exceeds the 4000 character safety limit.');
  }
  if (
    request.maxOutputTokens !== undefined &&
    (!Number.isInteger(request.maxOutputTokens) ||
      request.maxOutputTokens < 16 ||
      request.maxOutputTokens > 4096)
  ) {
    throw new AiProviderError('maxOutputTokens must be an integer between 16 and 4096.');
  }
  if (
    request.temperature !== undefined &&
    (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 1)
  ) {
    throw new AiProviderError('temperature must be a finite number between 0 and 1.');
  }
}

export class GeminiProvider implements AiProvider {
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(config: GeminiProviderConfig, fetcher: typeof fetch = fetch) {
    if (!config.apiKey || config.apiKey.trim().length < 10) {
      throw new AiUnavailableError();
    }
    this.model = config.model?.trim() || 'gemini-2.0-flash';
    this.endpoint = (
      config.endpoint?.trim() || 'https://generativelanguage.googleapis.com'
    ).replace(/\/$/, '');
    this.fetcher = fetcher;
    this.apiKey = config.apiKey;
  }

  private readonly apiKey: string;

  async generate(request: AiGenerationRequest): Promise<AiGenerationResponse> {
    validateRequest(request);
    const url = `${this.endpoint}/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      ...(request.systemInstruction
        ? { systemInstruction: { parts: [{ text: request.systemInstruction }] } }
        : {}),
      generationConfig: {
        maxOutputTokens: request.maxOutputTokens ?? 512,
        temperature: request.temperature ?? 0.2,
      },
    };

    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new AiProviderError('AI provider network request failed.');
    }
    if (!response.ok) {
      throw new AiProviderError(`AI provider returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    if (!isGeminiResponse(body)) {
      throw new AiProviderError('AI provider returned an invalid response.');
    }
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (!text) {
      throw new AiProviderError('AI provider returned no text candidate.');
    }
    return { provider: 'gemini', model: this.model, text };
  }
}
