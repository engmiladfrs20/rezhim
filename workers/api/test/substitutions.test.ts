import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type { ApiResponse, FoodDetail, FoodSubstitutionResult } from '@nutriai/types';

const testEnv = env as ProvidedEnv;
const SOURCE = {
  source_id: 'src_open_iranian_foods',
  source_url: 'https://example.com/source',
  citation: 'Substitution integration fixture',
  dataset_version: '1',
  method: 'database' as const,
  retrieved_at: '2026-08-31T00:00:00.000Z',
  license: 'Public Domain',
};

describe('Phase 10 — food substitutions API', () => {
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
          email: 'substitution-user@example.com',
          password: 'SubstitutionPassword123!',
          display_name: 'Substitution user',
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
          email: 'substitution-user@example.com',
          password: 'SubstitutionPassword123!',
        }),
      },
      testEnv,
    );
    expect(login.status).toBe(200);
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;

    const adminRegister = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'substitution-admin@example.com',
          password: 'SubstitutionAdminPassword123!',
          display_name: 'Substitution admin',
        }),
      },
      testEnv,
    );
    expect(adminRegister.status).toBe(201);
    await db
      .prepare(
        "UPDATE users SET role = 'admin' WHERE email_normalized = 'substitution-admin@example.com'",
      )
      .run();
    const adminLogin = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'substitution-admin@example.com',
          password: 'SubstitutionAdminPassword123!',
        }),
      },
      testEnv,
    );
    const adminToken = ((await adminLogin.json()) as ApiResponse<{ token: string }>).data.token;

    foodIds.length = 0;
    for (const [index, energy] of [200, 198, 205, 500].entries()) {
      const response = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            status: 'active',
            translations: [
              { locale: 'fa', name: `جایگزین ${index}` },
              { locale: 'en', name: `Substitute ${index}` },
            ],
            nutrients: [
              {
                nutrient_id: 'nut_energy',
                amount_per_100g: energy,
                external_id: `sub-energy-${index}`,
                ...SOURCE,
              },
              {
                nutrient_id: 'nut_protein',
                amount_per_100g: index === 3 ? 3 : 20,
                external_id: `sub-protein-${index}`,
                ...SOURCE,
              },
              {
                nutrient_id: 'nut_carbohydrate',
                amount_per_100g: index === 3 ? 80 : 25,
                external_id: `sub-carbs-${index}`,
                ...SOURCE,
              },
              {
                nutrient_id: 'nut_fat_total',
                amount_per_100g: index === 3 ? 20 : 8,
                external_id: `sub-fat-${index}`,
                ...SOURCE,
              },
            ],
          }),
        },
        testEnv,
      );
      expect(response.status).toBe(201);
      foodIds.push(((await response.json()) as ApiResponse<{ food: FoodDetail }>).data.food.id);
    }
  });

  it('requires authentication and validates exactly one reference portion', async () => {
    const unauthenticated = await app.request('/api/v1/substitutions', { method: 'POST' }, testEnv);
    expect(unauthenticated.status).toBe(401);
    const invalid = await app.request(
      '/api/v1/substitutions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          food_id: foodIds[0],
          grams: 100,
          serving_id: 'nope',
          candidate_food_ids: foodIds.slice(1),
        }),
      },
      testEnv,
    );
    expect(invalid.status).toBe(400);
  });

  it('returns stable, provenance-checked alternatives scaled to the reference energy', async () => {
    const request = {
      food_id: foodIds[0],
      grams: 100,
      candidate_food_ids: foodIds.slice(1),
      limit: 2,
    };
    const first = await app.request(
      '/api/v1/substitutions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
      },
      testEnv,
    );
    expect(first.status).toBe(200);
    const result = ((await first.json()) as ApiResponse<FoodSubstitutionResult>).data;
    expect(result.algorithmVersion).toBe('phase10-v1');
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0]?.food.foodId).not.toBe(foodIds[0]);
    expect(result.reference.energyKcal).toBe(200);
    expect(result.recommendations[0]?.food.energyKcal).toBeCloseTo(200, 1);
  });
});
