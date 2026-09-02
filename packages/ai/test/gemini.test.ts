import { describe, expect, it, vi } from 'vitest';
import {
  AiProviderError,
  AiUnavailableError,
  CloudflareAiProvider,
  GeminiProvider,
  createAiProvider,
  createGeminiProvider,
} from '../src';
import type { CloudflareEnv } from '@nutriai/types';

describe('Gemini provider boundary', () => {
  it('builds a safe request and extracts text without exposing the API key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: ' پاسخ ' } }] }), {
        status: 200,
      }),
    );
    const provider = new GeminiProvider(
      { apiKey: 'secret-key-123', model: 'test-model', endpoint: 'https://example.test/' },
      fetcher,
    );
    const result = await provider.generate({
      prompt: 'سلام',
      systemInstruction: 'Be concise',
      maxOutputTokens: 64,
      temperature: 0.1,
    });
    expect(result).toEqual({ provider: 'gemini', model: 'test-model', text: 'پاسخ' });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain('/v1beta/openai/chat/completions');
    expect(String(url)).not.toContain('secret-key-123');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-key-123');
    expect(String(init?.body)).toContain('سلام');
  });

  it('fails closed for missing credentials, invalid input, upstream errors, and empty output', async () => {
    expect(createGeminiProvider({})).toBeNull();
    expect(() => new GeminiProvider({ apiKey: 'short' })).toThrow(AiUnavailableError);
    const provider = new GeminiProvider(
      { apiKey: 'secret-key-123' },
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })),
    );
    await expect(provider.generate({ prompt: '' })).rejects.toThrow(AiProviderError);
    const failed = new GeminiProvider(
      { apiKey: 'secret-key-123' },
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 503 })),
    );
    await expect(failed.generate({ prompt: 'hello' })).rejects.toThrow('HTTP 503');
  });

  it('sends vision content as bounded inline data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'نان' } }] }), {
        status: 200,
      }),
    );
    const provider = new GeminiProvider({ apiKey: 'secret-key-123' }, fetcher);
    await expect(
      provider.generateVision({
        prompt: 'Identify the food.',
        imageBase64: 'aGVsbG8gd29ybGQ=',
        mimeType: 'image/jpeg',
      }),
    ).resolves.toMatchObject({ text: 'نان' });
    const [, init] = fetcher.mock.calls[0]!;
    const payload = JSON.parse(String(init?.body)) as {
      messages: Array<{ content: Array<Record<string, unknown>> }>;
    };
    expect(payload.messages[0]?.content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,aGVsbG8gd29ybGQ=' },
    });
  });

  it('rejects malformed or oversized vision data before network access', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new GeminiProvider({ apiKey: 'secret-key-123' }, fetcher);
    await expect(
      provider.generateVision({
        prompt: 'Identify the food.',
        imageBase64: 'not-base64!',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow('valid base64');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses the Cloudflare-hosted Google fallback when edge Gemini egress fails', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'fallback OK' });
    const provider = createAiProvider(
      {
        APP_ENV: 'production',
        GEMINI_API_KEY: 'secret-key-123',
        AI: { run },
      } as CloudflareEnv,
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 503 })),
    );
    expect(provider).not.toBeNull();
    const result = await provider!.generate({ prompt: 'hello' });
    expect(result).toEqual({
      provider: 'cloudflare-workers-ai',
      model: '@cf/google/gemma-4-26b-a4b-it',
      text: 'fallback OK',
    });
    expect(run).toHaveBeenCalledWith(
      '@cf/google/gemma-4-26b-a4b-it',
      expect.objectContaining({ messages: [{ role: 'user', content: 'hello' }] }),
    );
  });

  it('supports multimodal content through the Cloudflare fallback binding', async () => {
    const run = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'rice' } }],
    });
    const provider = new CloudflareAiProvider({ binding: { run } });
    const result = await provider.generateVision({
      prompt: 'Identify the food.',
      imageBase64: 'aGVsbG8gd29ybGQ=',
      mimeType: 'image/png',
    });
    expect(result.provider).toBe('cloudflare-workers-ai');
    const [, input] = run.mock.calls[0]!;
    expect(input.messages[0].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aGVsbG8gd29ybGQ=' },
    });
  });

  it('extracts text from nested Workers AI and multimodal response envelopes', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ result: { response: { output: 'nested fallback' } } })
      .mockResolvedValueOnce({
        choices: [{ message: { content: [{ type: 'text', text: 'vision fallback' }] } }],
      })
      .mockResolvedValueOnce({ choices: { 0: { message: { content: 'object choices' } } } });
    const provider = new CloudflareAiProvider({ binding: { run } });

    await expect(provider.generate({ prompt: 'hello' })).resolves.toMatchObject({
      text: 'nested fallback',
    });
    await expect(
      provider.generateVision({
        prompt: 'Identify the food.',
        imageBase64: 'aGVsbG8gd29ybGQ=',
        mimeType: 'image/jpeg',
      }),
    ).resolves.toMatchObject({ text: 'vision fallback' });
    await expect(provider.generate({ prompt: 'hello again' })).resolves.toMatchObject({
      text: 'object choices',
    });
  });
});
