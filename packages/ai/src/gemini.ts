import type { AiGenerationRequest, AiGenerationResponse, AiVisionRequest } from '@nutriai/types';
import { AiProviderError, AiUnavailableError } from './errors';

export interface AiProvider {
  generate(request: AiGenerationRequest): Promise<AiGenerationResponse>;
  generateVision(request: AiVisionRequest): Promise<AiGenerationResponse>;
}

export interface GeminiProviderConfig {
  apiKey: string;
  model?: string | undefined;
  endpoint?: string | undefined;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
}

interface OpenAiCompatibleResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

function isGeminiResponse(value: unknown): value is GeminiResponse {
  return typeof value === 'object' && value !== null;
}

function readResponseText(value: unknown): string | undefined {
  if (!isGeminiResponse(value)) return undefined;
  const gemini = value as GeminiResponse & OpenAiCompatibleResponse;
  const openAiText = gemini.choices?.[0]?.message?.content;
  if (typeof openAiText === 'string' && openAiText.trim()) return openAiText.trim();
  const geminiText = gemini.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  return geminiText || undefined;
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

function validateVisionRequest(request: AiVisionRequest): void {
  validateRequest(request);
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(request.imageBase64)
  ) {
    throw new AiProviderError('AI image data must be valid base64.');
  }
  if (request.imageBase64.length > 4_000_000) {
    throw new AiProviderError('AI image data exceeds the 3 MB safety limit.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(request.mimeType)) {
    throw new AiProviderError('AI image MIME type is not supported.');
  }
}

function describeNetworkError(error: unknown): string {
  const candidate =
    error instanceof Error
      ? error
      : typeof error === 'object' && error !== null
        ? (error as { message?: unknown; cause?: unknown })
        : undefined;
  const cause = candidate?.cause;
  const causeText =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'object' && cause !== null && 'message' in cause
        ? String((cause as { message?: unknown }).message ?? '')
        : typeof cause === 'string'
          ? cause
          : '';
  const detail =
    causeText || (candidate?.message ? String(candidate.message) : String(error ?? ''));
  if (detail && detail.length <= 160) return `AI provider network request failed: ${detail}`;
  return 'AI provider network request failed.';
}

export class GeminiProvider implements AiProvider {
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(config: GeminiProviderConfig, fetcher: typeof fetch = fetch) {
    if (!config.apiKey || config.apiKey.trim().length < 10) {
      throw new AiUnavailableError();
    }
    this.model = config.model?.trim() || 'gemini-3.6-flash';
    this.endpoint = (
      config.endpoint?.trim() || 'https://generativelanguage.googleapis.com'
    ).replace(/\/$/, '');
    this.fetcher = fetcher;
    this.apiKey = config.apiKey;
  }

  private readonly apiKey: string;

  async generate(request: AiGenerationRequest): Promise<AiGenerationResponse> {
    return this.generateContent(request, [{ text: request.prompt }]);
  }

  async generateVision(request: AiVisionRequest): Promise<AiGenerationResponse> {
    validateVisionRequest(request);
    return this.generateContent(request, [
      { text: request.prompt },
      { inline_data: { mime_type: request.mimeType, data: request.imageBase64 } },
    ]);
  }

  private async generateContent(
    request: AiGenerationRequest,
    parts: Array<Record<string, string | Record<string, string>>>,
  ): Promise<AiGenerationResponse> {
    validateRequest(request);
    // Use Gemini's official OpenAI-compatible endpoint. It avoids edge TLS
    // transport failures seen with the native generateContent route while
    // preserving the same Gemini models and API key.
    const url = `${this.endpoint}/v1beta/openai/chat/completions`;
    const content =
      parts.length === 1 && 'text' in parts[0]!
        ? parts[0]!.text
        : parts.map((part) => {
            if ('inline_data' in part) {
              const inlineData = part.inline_data as Record<string, string>;
              return {
                type: 'image_url',
                image_url: {
                  url: `data:${inlineData.mime_type};base64,${inlineData.data}`,
                },
              };
            }
            return { type: 'text', text: String(part.text ?? '') };
          });
    const payload = {
      model: this.model,
      messages: [
        ...(request.systemInstruction
          ? [{ role: 'system', content: request.systemInstruction }]
          : []),
        { role: 'user', content },
      ],
      max_tokens: request.maxOutputTokens ?? 512,
      temperature: request.temperature ?? 0.2,
    };

    let response: Response;
    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    };
    try {
      response = await this.fetcher(url, requestInit);
    } catch (error) {
      throw new AiProviderError(describeNetworkError(error));
    }
    if (!response.ok) {
      throw new AiProviderError(`AI provider returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    if (!isGeminiResponse(body)) {
      throw new AiProviderError('AI provider returned an invalid response.');
    }
    const text = readResponseText(body);
    if (!text) {
      throw new AiProviderError('AI provider returned no text candidate.');
    }
    return { provider: 'gemini', model: this.model, text };
  }
}
