import type { AiGenerationResponse, CloudflareEnv } from '@nutriai/types';
import { createGeminiProvider, AiUnavailableError } from '@nutriai/ai';
import type { AiGenerateInputDto } from '@nutriai/schemas';

export class AiService {
  constructor(private readonly env: CloudflareEnv) {}

  async generate(input: AiGenerateInputDto): Promise<AiGenerationResponse> {
    const provider = createGeminiProvider(this.env);
    if (!provider) throw new AiUnavailableError();
    return provider.generate({
      prompt: input.prompt,
      systemInstruction: input.system_instruction,
      maxOutputTokens: input.max_output_tokens,
      temperature: input.temperature,
    });
  }
}
