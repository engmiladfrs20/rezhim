import { foodDatasetItemSchema, foodSourceManifestSchema } from '@nutriai/schemas';
import type { FoodSourceManifest } from '@nutriai/types';
import openFoodsJson from '../../../data/sources/open-iranian-foods/foods.json';
import openManifestJson from '../../../data/sources/open-iranian-foods/source-manifest.json';
import fctFoodsJson from '../../../data/sources/iranian-fct-template/sample-template.json';
import fctManifestJson from '../../../data/sources/iranian-fct-template/source-manifest.json';

// Parse repository-owned files through the production schemas so test data
// cannot silently drift from the actual distributable datasets.
function parseManifest(input: unknown): FoodSourceManifest {
  const parsed = foodSourceManifestSchema.parse(input);
  return { ...parsed, description: parsed.description ?? null };
}

export const openIranianSourceManifest = parseManifest(openManifestJson);
export const openIranianFoods = foodDatasetItemSchema.array().parse(openFoodsJson);
export const fctManifest = parseManifest(fctManifestJson);
export const fctTemplateFoods = foodDatasetItemSchema.array().parse(fctFoodsJson);
