import type {
  AiCoachResponse,
  AiGenerationResponse,
  AggregatedNutritionResult,
  CloudflareEnv,
} from '@nutriai/types';
import { buildCoachPrompt, createGeminiProvider, AiUnavailableError } from '@nutriai/ai';
import { calculateNutritionTargets } from '@nutriai/nutrition';
import type { AiGenerateInputDto } from '@nutriai/schemas';
import type { AiCoachInputDto } from '@nutriai/schemas';

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

  async coach(input: AiCoachInputDto, diary: AggregatedNutritionResult): Promise<AiCoachResponse> {
    const provider = createGeminiProvider(this.env);
    if (!provider) throw new AiUnavailableError();
    const targets = buildTargets(input);
    const prompt = buildCoachPrompt({
      question: input.question,
      locale: input.locale,
      date: input.date,
      targets,
      diary,
    });
    const generated = await provider.generate(prompt);
    return {
      ...generated,
      date: input.date,
      disclaimer: 'This response is educational information, not medical advice or a diagnosis.',
    };
  }
}

function buildTargets(input: AiCoachInputDto) {
  // Kept in the service so the route never trusts client-provided calculated targets.
  return calculateNutritionTargets({
    ...input.biometrics,
    bodyFatPercentage: input.biometrics.bodyFatPercentage ?? undefined,
  });
}
