import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import type { ProvidedEnv } from 'cloudflare:workers';
import { app } from '../src/app';
import './apply-migrations';
import { FoodImporterService } from '../src/services/food-importer.service';
import type {
  ApiResponse,
  ApiErrorResponse,
  CalculatedNutritionTargets,
  AggregatedNutritionResult,
  FoodDatasetFile,
} from '@nutriai/types';
import { openIranianFoods, openIranianSourceManifest } from './dataset-fixtures';

const testEnv = env as ProvidedEnv;

describe('Phase 6 — Nutrition Engine API Tests', () => {
  let authToken: string;
  let activeChickenId: string;
  let activeRiceId: string;
  let draftFoodId: string;
  let chickenServingId: string;

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();

    // Import baseline dataset so we have real active & draft foods in D1
    const importer = new FoodImporterService(db);
    const rawContent = JSON.stringify(openIranianFoods);
    const calculatedChecksum = await importer.computeChecksum(rawContent);

    const validDataset: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: calculatedChecksum,
      },
      foods: openIranianFoods,
    };

    const importRes = await importer.runPipeline(validDataset, rawContent, 'import', {
      executedBy: 'test-runner',
    });
    expect(importRes.status, importRes.errors.join('; ')).toBe('success');

    // Lookup active & draft foods
    const chickenRow = await db
      .prepare("SELECT id FROM foods WHERE external_id = 'item_chicken_breast_grilled'")
      .first<{ id: string }>();
    activeChickenId = chickenRow!.id;

    const lentilsRow = await db
      .prepare("SELECT id FROM foods WHERE external_id = 'item_lentils_cooked'")
      .first<{ id: string }>();
    activeRiceId = lentilsRow!.id;

    const draftRow = await db
      .prepare("SELECT id FROM foods WHERE status = 'draft' LIMIT 1")
      .first<{ id: string }>();
    draftFoodId = draftRow!.id;

    // Lookup serving ID for chicken
    const servRow = await db
      .prepare('SELECT id FROM food_servings WHERE food_id = ? LIMIT 1')
      .bind(activeChickenId)
      .first<{ id: string }>();
    chickenServingId = servRow!.id;

    // Register & login test user
    const userEmail = `nutrition_user_${crypto.randomUUID()}@nutriai.persia`;
    const regRes = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          password: 'Password123!',
          display_name: 'Nutrition Tester',
          locale: 'fa',
        }),
      },
      testEnv,
    );
    expect(regRes.status).toBe(201);

    const tokenRes = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          password: 'Password123!',
        }),
      },
      testEnv,
    );
    expect(tokenRes.status).toBe(200);
    const tokenData = (await tokenRes.json()) as ApiResponse<{ token: string }>;
    authToken = tokenData.data.token;
  });

  describe('POST /api/v1/nutrition/targets', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await app.request(
        '/api/v1/nutrition/targets',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gender: 'male',
            age: 30,
            heightCm: 180,
            weightKg: 80,
            activityLevel: 'moderately_active',
            dietGoal: 'maintenance',
            formula: 'mifflin_st_jeor',
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid or out-of-range biometric inputs', async () => {
      const res = await app.request(
        '/api/v1/nutrition/targets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            gender: 'male',
            age: 5, // Invalid: < 10
            heightCm: 180,
            weightKg: 80,
            activityLevel: 'moderately_active',
            dietGoal: 'maintenance',
            formula: 'mifflin_st_jeor',
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when Katch-McArdle formula is requested without body fat percentage', async () => {
      const res = await app.request(
        '/api/v1/nutrition/targets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            gender: 'male',
            age: 30,
            heightCm: 180,
            weightKg: 80,
            activityLevel: 'moderately_active',
            dietGoal: 'maintenance',
            formula: 'katch_mcardle',
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(400);
    });

    it('calculates targets for male with Mifflin-St Jeor formula accurately', async () => {
      const res = await app.request(
        '/api/v1/nutrition/targets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            gender: 'male',
            age: 30,
            heightCm: 180,
            weightKg: 80,
            activityLevel: 'moderately_active',
            dietGoal: 'maintenance',
            formula: 'mifflin_st_jeor',
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse<CalculatedNutritionTargets>;
      expect(json.success).toBe(true);

      const { data } = json;
      expect(data.bmr).toBe(1780);
      expect(data.tdee).toBe(2759);
      expect(data.targetCalories).toBe(2759);
      expect(data.calorieDelta).toBe(0);

      expect(
        data.macronutrients.proteinPercentage +
          data.macronutrients.carbsPercentage +
          data.macronutrients.fatPercentage,
      ).toBe(100);

      expect(data.micronutrients.recommendedWaterMl).toBe(2800); // 80 * 35
      expect(data.micronutrients.recommendedIronMg).toBe(8); // Male iron
    });

    it('calculates targets for female with gender-specific micronutrients (18mg iron, 2600mg potassium)', async () => {
      const res = await app.request(
        '/api/v1/nutrition/targets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            gender: 'female',
            age: 26,
            heightCm: 165,
            weightKg: 60,
            activityLevel: 'lightly_active',
            dietGoal: 'weight_loss_mild',
            formula: 'mifflin_st_jeor',
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse<CalculatedNutritionTargets>;
      expect(json.data.micronutrients.recommendedIronMg).toBe(18);
      expect(json.data.micronutrients.recommendedPotassiumMg).toBe(2600);
    });

    it('calculates targets with Katch-McArdle formula when body fat is provided', async () => {
      const res = await app.request(
        '/api/v1/nutrition/targets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            gender: 'male',
            age: 30,
            heightCm: 180,
            weightKg: 80,
            bodyFatPercentage: 15,
            activityLevel: 'very_active',
            dietGoal: 'muscle_gain_mild',
            formula: 'katch_mcardle',
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse<CalculatedNutritionTargets>;
      expect(json.data.bmr).toBe(1839); // 370 + 21.6 * (80 * 0.85) = 1838.8 -> 1839
      expect(json.data.calorieDelta).toBe(300);
    });
  });

  describe('POST /api/v1/nutrition/aggregate', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ foodId: activeChickenId, grams: 150 }],
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when items array is empty or missing', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ items: [] }),
        },
        testEnv,
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when food ID does not exist in database', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            items: [{ foodId: 'food_non_existent', grams: 100 }],
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when attempting to aggregate a draft food', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            items: [{ foodId: draftFoodId, grams: 100 }],
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('Only active foods');
    });

    it('returns 400 when serving ID does not exist on the food', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            items: [{ foodId: activeChickenId, servingId: 'srv_fake_id', quantity: 1 }],
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(400);
    });

    it('aggregates nutrition accurately by grams for active foods', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            items: [{ foodId: activeChickenId, grams: 200 }],
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: true;
        data: AggregatedNutritionResult;
      };
      expect(json.success).toBe(true);

      const { data } = json;
      expect(data.totalPortionGrams).toBe(200);
      expect(data.items.length).toBe(1);
      expect(data.items[0]?.foodId).toBe(activeChickenId);
      expect(data.items[0]?.portionGrams).toBe(200);
      expect(data.totalEnergyKcal).toBeGreaterThan(0);
      expect(data.totalProteinGrams).toBeGreaterThan(0);
    });

    it('aggregates nutrition accurately by serving and quantity', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            items: [{ foodId: activeChickenId, servingId: chickenServingId, quantity: 2 }],
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: true;
        data: AggregatedNutritionResult;
      };
      expect(json.success).toBe(true);

      const { data } = json;
      expect(data.items[0]?.serving).toBeDefined();
      expect(data.items[0]?.serving?.quantity).toBe(2);
      expect(data.totalPortionGrams).toBe(data.items[0]!.serving!.weightG * 2);
    });

    it('aggregates multiple foods together, calculating combined macros and missing optional nutrients report', async () => {
      const res = await app.request(
        '/api/v1/nutrition/aggregate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            items: [
              { foodId: activeChickenId, grams: 150 },
              { foodId: activeRiceId, grams: 100 },
            ],
          }),
        },
        testEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: true;
        data: AggregatedNutritionResult;
      };
      expect(json.success).toBe(true);

      const { data } = json;
      expect(data.totalPortionGrams).toBe(250);
      expect(data.items.length).toBe(2);
      expect(data.totalEnergyKcal).toBeCloseTo(
        data.items[0]!.energyKcal + data.items[1]!.energyKcal,
        1,
      );
      expect(data.totalProteinGrams).toBeCloseTo(
        data.items[0]!.proteinGrams + data.items[1]!.proteinGrams,
        1,
      );
      expect(data.totalCarbsGrams).toBeCloseTo(
        data.items[0]!.carbsGrams + data.items[1]!.carbsGrams,
        1,
      );
      expect(data.totalFatGrams).toBeCloseTo(data.items[0]!.fatGrams + data.items[1]!.fatGrams, 1);
    });
  });
});
