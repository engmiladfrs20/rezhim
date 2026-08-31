import { beforeEach, describe, expect, it } from 'vitest';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import { app } from '../src/app';
import './apply-migrations';
import { FoodImporterService } from '../src/services/food-importer.service';
import { openIranianFoods, openIranianSourceManifest } from './dataset-fixtures';
import type { ApiResponse, FoodDatasetFile, RecipeNutritionResult } from '@nutriai/types';

const testEnv = env as ProvidedEnv;

describe('Phase 17 — deterministic recipe nutrition API', () => {
  let token = '';
  let lentilsId = '';
  let chickpeasId = '';

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();

    const importer = new FoodImporterService(db);
    const rawContent = JSON.stringify(openIranianFoods);
    const checksum = await importer.computeChecksum(rawContent);
    const result = await importer.runPipeline(
      {
        manifest: { ...openIranianSourceManifest, sha256Checksum: checksum },
        foods: openIranianFoods,
      } satisfies FoodDatasetFile,
      rawContent,
      'import',
      { executedBy: 'recipe-test' },
    );
    expect(result.status, result.errors.join('; ')).toBe('success');

    lentilsId = (await db
      .prepare("SELECT id FROM foods WHERE external_id = 'item_lentils_cooked'")
      .first<{ id: string }>())!.id;
    chickpeasId = (await db
      .prepare("SELECT id FROM foods WHERE external_id = 'item_chickpeas_cooked'")
      .first<{ id: string }>())!.id;

    const email = `recipe_${crypto.randomUUID()}@nutriai.persia`;
    const register = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'RecipePassword123!',
          display_name: 'Recipe User',
        }),
      },
      testEnv,
    );
    expect(register.status).toBe(201);
    const login = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'RecipePassword123!' }),
      },
      testEnv,
    );
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;
  });

  it('requires authentication before calculating a recipe', async () => {
    const response = await app.request(
      '/api/v1/recipes/calculate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: [{ food_id: lentilsId, grams: 100 }],
          yield_grams: 100,
        }),
      },
      testEnv,
    );
    expect(response.status).toBe(401);
  });

  it('calculates total, per-100g, and per-serving nutrition from active foods', async () => {
    const response = await app.request(
      '/api/v1/recipes/calculate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ingredients: [
            { food_id: lentilsId, grams: 100 },
            { food_id: chickpeasId, grams: 100 },
          ],
          yield_grams: 160,
          servings: 2,
        }),
      },
      testEnv,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApiResponse<RecipeNutritionResult>;
    expect(body.data.algorithmVersion).toBe('recipe-nutrition-v1');
    expect(body.data.total.portionGrams).toBe(200);
    expect(body.data.per100g.portionGrams).toBe(100);
    expect(body.data.perServing.portionGrams).toBe(80);
    expect(body.data.perServing.energyKcal).toBeCloseTo(body.data.total.energyKcal / 2, 1);
    expect(body.data.per100g.energyKcal).toBeCloseTo((body.data.total.energyKcal * 100) / 160, 1);
    expect(body.data.ingredients).toHaveLength(2);
  });

  it('rejects duplicate ingredients and non-positive yield at the API boundary', async () => {
    const response = await app.request(
      '/api/v1/recipes/calculate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ingredients: [
            { food_id: lentilsId, grams: 100 },
            { food_id: lentilsId, grams: 50 },
          ],
          yield_grams: 0,
        }),
      },
      testEnv,
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('rejects draft or missing foods through the existing provenance boundary', async () => {
    const response = await app.request(
      '/api/v1/recipes/calculate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ingredients: [{ food_id: 'missing-food', grams: 100 }],
          yield_grams: 100,
        }),
      },
      testEnv,
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });
});
