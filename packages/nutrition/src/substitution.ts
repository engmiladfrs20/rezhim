import type {
  FoodPortionNutrition,
  FoodSubstitutionRecommendation,
  FoodSubstitutionResult,
} from '@nutriai/types';
import { NutritionValidationError } from './errors';
import { scaleFoodPortionNutrition } from './meal-plan';

export interface FoodSubstitutionInput {
  reference: FoodPortionNutrition;
  candidates: FoodPortionNutrition[];
  limit?: number | undefined;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function per100(value: number, grams: number): number {
  return (value / grams) * 100;
}

function validate(input: FoodSubstitutionInput): void {
  if (!input || !input.reference || !Array.isArray(input.candidates)) {
    throw new NutritionValidationError(
      'Substitution input must contain a reference and candidates.',
    );
  }
  if (!Number.isInteger(input.limit ?? 5) || (input.limit ?? 5) < 1 || (input.limit ?? 5) > 10) {
    throw new NutritionValidationError(
      'Substitution limit must be an integer between 1 and 10.',
      'limit',
    );
  }
  if (
    !Number.isFinite(input.reference.portionGrams) ||
    input.reference.portionGrams <= 0 ||
    input.reference.energyKcal <= 0
  ) {
    throw new NutritionValidationError(
      'Reference food must have positive finite nutrition.',
      'reference',
    );
  }
  const seen = new Set<string>();
  for (const candidate of input.candidates) {
    if (!candidate || !candidate.foodId || seen.has(candidate.foodId)) {
      throw new NutritionValidationError(
        'Substitution candidates must have unique food IDs.',
        'candidates',
      );
    }
    seen.add(candidate.foodId);
    if (
      !Number.isFinite(candidate.portionGrams) ||
      candidate.portionGrams <= 0 ||
      candidate.energyKcal <= 0
    ) {
      throw new NutritionValidationError(
        `Candidate ${candidate.foodId} has invalid nutrition.`,
        'candidates',
      );
    }
  }
}

function recommendation(
  reference: FoodPortionNutrition,
  candidate: FoodPortionNutrition,
): FoodSubstitutionRecommendation {
  const refEnergy = per100(reference.energyKcal, reference.portionGrams);
  const refProtein = per100(reference.proteinGrams, reference.portionGrams);
  const refCarbs = per100(reference.carbsGrams, reference.portionGrams);
  const refFat = per100(reference.fatGrams, reference.portionGrams);
  const candidateEnergy = per100(candidate.energyKcal, candidate.portionGrams);
  const candidateProtein = per100(candidate.proteinGrams, candidate.portionGrams);
  const candidateCarbs = per100(candidate.carbsGrams, candidate.portionGrams);
  const candidateFat = per100(candidate.fatGrams, candidate.portionGrams);

  const energyDelta = Math.abs(candidateEnergy - refEnergy) / Math.max(refEnergy, 1);
  const proteinDelta = Math.abs(candidateProtein - refProtein) / Math.max(refProtein, 1);
  const carbsDelta = Math.abs(candidateCarbs - refCarbs) / Math.max(refCarbs, 1);
  const fatDelta = Math.abs(candidateFat - refFat) / Math.max(refFat, 1);
  const score = energyDelta * 0.45 + proteinDelta * 0.25 + carbsDelta * 0.15 + fatDelta * 0.15;
  const targetEnergy = reference.energyKcal;
  const grams = Math.min(
    800,
    Math.max(25, (targetEnergy / candidateEnergy) * candidate.portionGrams),
  );
  const reasons: string[] = [];
  if (energyDelta <= 0.1) reasons.push('similar energy density');
  if (proteinDelta <= 0.2) reasons.push('similar protein density');
  if (carbsDelta <= 0.2) reasons.push('similar carbohydrate density');
  if (fatDelta <= 0.2) reasons.push('similar fat density');
  if (reasons.length === 0) reasons.push('closest available macro profile');
  return {
    food: scaleFoodPortionNutrition(candidate, grams),
    similarityScore: round(Math.max(0, 100 - score * 100), 1),
    reasons,
  };
}

/** Returns stable, nutrition-similar alternatives; this is not medical advice. */
export function findFoodSubstitutions(input: FoodSubstitutionInput): FoodSubstitutionResult {
  validate(input);
  const limit = input.limit ?? 5;
  const candidates = input.candidates
    .filter((candidate) => candidate.foodId !== input.reference.foodId)
    .map((candidate) => recommendation(input.reference, candidate))
    .sort(
      (a, b) => b.similarityScore - a.similarityScore || a.food.foodId.localeCompare(b.food.foodId),
    )
    .slice(0, limit);
  return {
    algorithmVersion: 'phase10-v1',
    reference: input.reference,
    recommendations: candidates,
  };
}
