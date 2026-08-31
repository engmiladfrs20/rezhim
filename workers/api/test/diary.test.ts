import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type {
  ApiResponse,
  FoodDetail,
  FoodDiaryEntryWithNutrition,
  DailyDiarySummary,
} from '@nutriai/types';

const testEnv = env as ProvidedEnv;
const PROVENANCE = {
  source_id: 'src_usda_fdc',
  external_id: 'diary-fixture',
  source_url: 'https://fdc.nal.usda.gov/',
  citation: 'USDA FoodData Central diary fixture',
  dataset_version: 'diary-1',
  method: 'database' as const,
  retrieved_at: '2026-08-30T00:00:00.000Z',
  license: 'Public Domain',
};

function macros(energy: number) {
  return [
    { nutrient_id: 'nut_energy', amount_per_100g: energy, ...PROVENANCE },
    { nutrient_id: 'nut_protein', amount_per_100g: 10, ...PROVENANCE },
    { nutrient_id: 'nut_carbohydrate', amount_per_100g: 20, ...PROVENANCE },
    { nutrient_id: 'nut_fat_total', amount_per_100g: 5, ...PROVENANCE },
  ];
}

describe('Food Diary API — ownership, portions, and daily summaries', () => {
  let adminToken: string;
  let userToken: string;
  let otherUserToken: string;
  let foodId: string;
  let servingId: string;

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM food_diary_entries').run();
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();
    await db.prepare('DELETE FROM foods').run();

    const register = async (email: string, password: string) => {
      const response = await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, display_name: email.split('@')[0] }),
        },
        testEnv,
      );
      expect(response.status).toBe(201);
    };
    const token = async (email: string, password: string) => {
      const response = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        },
        testEnv,
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as ApiResponse<{ token: string }>).data.token;
    };

    await register('diary-admin@example.com', 'DiaryAdminPassword123!');
    await db
      .prepare("UPDATE users SET role = 'admin' WHERE email_normalized = 'diary-admin@example.com'")
      .run();
    adminToken = await token('diary-admin@example.com', 'DiaryAdminPassword123!');

    await register('diary-user@example.com', 'DiaryUserPassword123!');
    userToken = await token('diary-user@example.com', 'DiaryUserPassword123!');
    await register('diary-other@example.com', 'DiaryOtherPassword123!');
    otherUserToken = await token('diary-other@example.com', 'DiaryOtherPassword123!');

    const foodResponse = await app.request(
      '/api/v1/admin/foods',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          status: 'active',
          translations: [
            { locale: 'fa', name: 'غذای دفتر خاطرات' },
            { locale: 'en', name: 'Diary food' },
          ],
          nutrients: macros(200),
          servings: [
            {
              name_fa: 'یک کاسه',
              name_en: 'one bowl',
              weight_g: 150,
              household_unit: 'bowl',
              ...PROVENANCE,
            },
          ],
        }),
      },
      testEnv,
    );
    expect(foodResponse.status).toBe(201);
    const food = ((await foodResponse.json()) as ApiResponse<{ food: FoodDetail }>).data.food;
    foodId = food.id;
    servingId = food.servings[0]!.id;
  });

  it('requires authentication and validates exactly one portion mode', async () => {
    const unauthenticated = await app.request('/api/v1/diary?date=2026-08-31', {}, testEnv);
    expect(unauthenticated.status).toBe(401);

    const invalid = await app.request(
      '/api/v1/diary',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ food_id: foodId, grams: 100, serving_id: servingId }),
      },
      testEnv,
    );
    expect(invalid.status).toBe(400);
  });

  it('creates, lists, updates, and deletes a grams-based entry with calculated nutrition', async () => {
    const consumedAt = '2026-08-31T08:30:00.000Z';
    const create = await app.request(
      '/api/v1/diary',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
          food_id: foodId,
          grams: 200,
          meal_type: 'breakfast',
          consumed_at: consumedAt,
          note: 'صبحانه آزمایشی',
        }),
      },
      testEnv,
    );
    expect(create.status).toBe(201);
    const created = ((await create.json()) as ApiResponse<{ entry: FoodDiaryEntryWithNutrition }>)
      .data.entry;
    expect(created.userId).not.toBeUndefined();
    expect(created.nutrition.energyKcal).toBe(400);
    expect(created.nutrition.portionGrams).toBe(200);

    const list = await app.request(
      '/api/v1/diary?date=2026-08-31&locale=fa',
      { headers: { Authorization: `Bearer ${userToken}` } },
      testEnv,
    );
    expect(list.status).toBe(200);
    const summary = ((await list.json()) as ApiResponse<DailyDiarySummary>).data;
    expect(summary.date).toBe('2026-08-31');
    expect(summary.entries).toHaveLength(1);
    expect(summary.nutrition.totalEnergyKcal).toBe(400);

    const update = await app.request(
      `/api/v1/diary/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ meal_type: 'lunch', note: 'ویرایش شد' }),
      },
      testEnv,
    );
    expect(update.status).toBe(200);
    const updated = ((await update.json()) as ApiResponse<{ entry: FoodDiaryEntryWithNutrition }>)
      .data.entry;
    expect(updated.mealType).toBe('lunch');
    expect(updated.note).toBe('ویرایش شد');

    const remove = await app.request(
      `/api/v1/diary/${created.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${userToken}` } },
      testEnv,
    );
    expect(remove.status).toBe(200);
    const after = await app.request(
      '/api/v1/diary?date=2026-08-31',
      { headers: { Authorization: `Bearer ${userToken}` } },
      testEnv,
    );
    expect(((await after.json()) as ApiResponse<DailyDiarySummary>).data.entries).toHaveLength(0);
  });

  it('supports serving quantities and prevents cross-user access', async () => {
    const create = await app.request(
      '/api/v1/diary',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({
          food_id: foodId,
          serving_id: servingId,
          quantity: 2,
          meal_type: 'dinner',
        }),
      },
      testEnv,
    );
    expect(create.status).toBe(201);
    const entry = ((await create.json()) as ApiResponse<{ entry: FoodDiaryEntryWithNutrition }>)
      .data.entry;
    expect(entry.nutrition.portionGrams).toBe(300);
    expect(entry.nutrition.energyKcal).toBe(600);

    const otherList = await app.request(
      `/api/v1/diary?date=${new Date().toISOString().slice(0, 10)}`,
      { headers: { Authorization: `Bearer ${otherUserToken}` } },
      testEnv,
    );
    expect(((await otherList.json()) as ApiResponse<DailyDiarySummary>).data.entries).toHaveLength(
      0,
    );

    const forbiddenUpdate = await app.request(
      `/api/v1/diary/${entry.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherUserToken}` },
        body: JSON.stringify({ note: 'hijack' }),
      },
      testEnv,
    );
    expect(forbiddenUpdate.status).toBe(404);

    const forbiddenDelete = await app.request(
      `/api/v1/diary/${entry.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${otherUserToken}` } },
      testEnv,
    );
    expect(forbiddenDelete.status).toBe(404);
  });

  it('rejects invalid calendar dates and missing entries with stable errors', async () => {
    const badDate = await app.request(
      '/api/v1/diary?date=2026-02-30',
      { headers: { Authorization: `Bearer ${userToken}` } },
      testEnv,
    );
    expect(badDate.status).toBe(400);

    const missing = await app.request(
      '/api/v1/diary/diary_missing',
      { method: 'DELETE', headers: { Authorization: `Bearer ${userToken}` } },
      testEnv,
    );
    expect(missing.status).toBe(404);
  });
});
