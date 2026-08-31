import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type { ApiResponse, GeneratedMealPlan } from '@nutriai/types';

const testEnv = env as ProvidedEnv;

describe('Phase 9 — deterministic meal plan API', () => {
  let token: string;
  const foodIds: string[] = [];

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM food_diary_entries').run();
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();
    await db.prepare('DELETE FROM foods').run();

    const register = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'meal-plan-user@example.com',
          password: 'MealPlanPassword123!',
          display_name: 'Meal plan user',
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
        body: JSON.stringify({
          email: 'meal-plan-user@example.com',
          password: 'MealPlanPassword123!',
        }),
      },
      testEnv,
    );
    expect(login.status).toBe(200);
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;

    const admin = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'meal-plan-admin@example.com',
          password: 'MealPlanAdminPassword123!',
          display_name: 'Meal plan admin',
        }),
      },
      testEnv,
    );
    expect(admin.status).toBe(201);
    await db
      .prepare(
        "UPDATE users SET role = 'admin' WHERE email_normalized = 'meal-plan-admin@example.com'",
      )
      .run();
    const adminLogin = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'meal-plan-admin@example.com',
          password: 'MealPlanAdminPassword123!',
        }),
      },
      testEnv,
    );
    const adminToken = ((await adminLogin.json()) as ApiResponse<{ token: string }>).data.token;

    foodIds.length = 0;
    for (const [index, energy] of [150, 200, 250, 300].entries()) {
      const response = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            status: 'active',
            translations: [
              { locale: 'fa', name: `غذای برنامه ${index}` },
              { locale: 'en', name: `Plan food ${index}` },
            ],
            nutrients: [
              {
                nutrient_id: 'nut_energy',
                amount_per_100g: energy,
                source_id: 'src_open_iranian_foods',
                external_id: `energy-${index}`,
                source_url: 'https://example.com/source',
                citation: 'Meal plan test',
                dataset_version: '1',
                method: 'database',
                retrieved_at: '2026-08-31T00:00:00.000Z',
                license: 'Public Domain',
              },
              {
                nutrient_id: 'nut_protein',
                amount_per_100g: 20,
                source_id: 'src_open_iranian_foods',
                external_id: `protein-${index}`,
                source_url: 'https://example.com/source',
                citation: 'Meal plan test',
                dataset_version: '1',
                method: 'database',
                retrieved_at: '2026-08-31T00:00:00.000Z',
                license: 'Public Domain',
              },
              {
                nutrient_id: 'nut_carbohydrate',
                amount_per_100g: 30,
                source_id: 'src_open_iranian_foods',
                external_id: `carbs-${index}`,
                source_url: 'https://example.com/source',
                citation: 'Meal plan test',
                dataset_version: '1',
                method: 'database',
                retrieved_at: '2026-08-31T00:00:00.000Z',
                license: 'Public Domain',
              },
              {
                nutrient_id: 'nut_fat_total',
                amount_per_100g: 10,
                source_id: 'src_open_iranian_foods',
                external_id: `fat-${index}`,
                source_url: 'https://example.com/source',
                citation: 'Meal plan test',
                dataset_version: '1',
                method: 'database',
                retrieved_at: '2026-08-31T00:00:00.000Z',
                license: 'Public Domain',
              },
            ],
          }),
        },
        testEnv,
      );
      if (response.status !== 201) {
        throw new Error(`fixture food creation failed at ${index}: ${response.status}`);
      }
      foodIds.push(((await response.json()) as ApiResponse<{ food: { id: string } }>).data.food.id);
    }
  });

  it('requires authentication and validates the candidate set', async () => {
    const unauthenticated = await app.request(
      '/api/v1/meal-plans/generate',
      { method: 'POST' },
      testEnv,
    );
    expect(unauthenticated.status).toBe(401);

    const invalid = await app.request(
      '/api/v1/meal-plans/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ food_ids: foodIds.slice(0, 3), days: 1, targets: {} }),
      },
      testEnv,
    );
    expect(invalid.status).toBe(400);
  });

  it('generates stable four-meal schedules from active, provenance-checked foods', async () => {
    const body = {
      food_ids: foodIds,
      days: 2,
      locale: 'fa',
      targets: {
        gender: 'male',
        age: 30,
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'moderately_active',
        dietGoal: 'maintenance',
        formula: 'mifflin_st_jeor',
      },
    };
    const first = await app.request(
      '/api/v1/meal-plans/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      testEnv,
    );
    expect(first.status).toBe(200);
    const firstPlan = ((await first.json()) as ApiResponse<GeneratedMealPlan>).data;
    expect(firstPlan.algorithmVersion).toBe('phase9-v1');
    expect(firstPlan.days).toHaveLength(2);
    expect(firstPlan.days[0]?.meals).toHaveLength(4);
    expect(firstPlan.days[0]?.nutrition.totalEnergyKcal).toBeGreaterThan(0);

    const second = await app.request(
      '/api/v1/meal-plans/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      testEnv,
    );
    expect(((await second.json()) as ApiResponse<GeneratedMealPlan>).data).toEqual(firstPlan);
  });
});
