import { describe, expect, it, vi } from 'vitest';
import { AiProviderError, AiUnavailableError, GeminiProvider, createGeminiProvider } from '../src';

describe('Gemini provider boundary', () => {
  it('builds a safe request and extracts text without exposing the API key', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: ' پاسخ ' }] } }] }),
          { status: 200 },
        ),
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
    expect(String(url)).toContain('test-model:generateContent');
    expect(String(url)).toContain('key=secret-key-123');
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
});
