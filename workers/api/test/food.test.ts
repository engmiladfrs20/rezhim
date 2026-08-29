import { describe, expect, it, beforeEach } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type {
  ApiResponse,
  ApiErrorResponse,
  FoodDetail,
  FoodSummary,
  FoodCategorySummary,
  NutrientDefinition,
  PaginatedResult,
} from '@nutriai/types';

const testEnv = env as ProvidedEnv;

describe('Food Catalog Data Foundation & Security Integration Tests', () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();
    await db.prepare('DELETE FROM foods').run();
    await db.prepare('DELETE FROM food_categories WHERE id NOT LIKE "cat_%"').run();

    // 1. Create Admin User & Session
    const adminReg = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'foodadmin@example.com',
          password: 'AdminPassword123!',
          display_name: 'Food Admin',
        }),
      },
      testEnv,
    );
    expect(adminReg.status).toBe(201);

    await db
      .prepare("UPDATE users SET role = 'admin' WHERE email_normalized = 'foodadmin@example.com'")
      .run();

    const adminTokenRes = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'foodadmin@example.com', password: 'AdminPassword123!' }),
      },
      testEnv,
    );
    adminToken = ((await adminTokenRes.json()) as ApiResponse<{ token: string }>).data.token;

    // 2. Create Regular User & Session
    const userReg = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fooduser@example.com',
          password: 'UserPassword123!',
          display_name: 'Food User',
        }),
      },
      testEnv,
    );
    expect(userReg.status).toBe(201);

    const userTokenRes = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'fooduser@example.com', password: 'UserPassword123!' }),
      },
      testEnv,
    );
    userToken = ((await userTokenRes.json()) as ApiResponse<{ token: string }>).data.token;
  });

  describe('D1 Database Integrity & Constraints', () => {
    it('enforces check constraints preventing negative nutrients and zero/negative serving weights', async () => {
      const db = testEnv.DB!;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('food_constraint_test', 'cat_fruits', 'generic', null, null, 'active', now, now)
        .run();

      // 1. Negative nutrient amount must fail D1 check constraint
      let nutrientError = false;
      try {
        await db
          .prepare(
            `INSERT INTO food_nutrients (id, food_id, nutrient_id, amount_per_100g, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind('fn_neg', 'food_constraint_test', 'nut_energy', -10, now, now)
          .run();
      } catch {
        nutrientError = true;
      }
      expect(nutrientError).toBe(true);

      // 2. Zero or negative serving weight must fail D1 check constraint
      let servingError = false;
      try {
        await db
          .prepare(
            `INSERT INTO food_servings (id, food_id, name_fa, name_en, weight_g, household_unit, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind('fs_zero', 'food_constraint_test', 'سروینگ', 'Serving', 0, null, now, now)
          .run();
      } catch {
        servingError = true;
      }
      expect(servingError).toBe(true);
    });

    it('enforces barcode and external source uniqueness in D1', async () => {
      const db = testEnv.DB!;
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'food_unique_1',
          'cat_dairy',
          'branded',
          'Kalleh',
          '626000000001',
          'active',
          'src_usda_fdc',
          'ext_1001',
          now,
          now,
        )
        .run();

      // Duplicate barcode insert directly into D1 must fail
      let barcodeDup = false;
      try {
        await db
          .prepare(
            `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            'food_unique_2',
            'cat_dairy',
            'branded',
            'OtherBrand',
            '626000000001',
            'active',
            now,
            now,
          )
          .run();
      } catch {
        barcodeDup = true;
      }
      expect(barcodeDup).toBe(true);

      // Duplicate source + external_id insert directly into D1 must fail
      let sourceDup = false;
      try {
        await db
          .prepare(
            `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            'food_unique_3',
            'cat_dairy',
            'generic',
            null,
            null,
            'active',
            'src_usda_fdc',
            'ext_1001',
            now,
            now,
          )
          .run();
      } catch {
        sourceDup = true;
      }
      expect(sourceDup).toBe(true);
    });
  });

  describe('Admin Food CRUD & Atomic Operations', () => {
    it('creates a new food atomically with translations, nutrients, and servings', async () => {
      const createPayload = {
        category_id: 'cat_grains',
        food_type: 'generic',
        status: 'active',
        barcode: '6261234567890',
        translations: [
          { locale: 'fa', name: 'نان سنگک سنتی', description: 'نان سنگک سبوس‌دار سنتی' },
          {
            locale: 'en',
            name: 'Traditional Sangak Bread',
            description: 'Whole wheat traditional sangak',
          },
        ],
        aliases: [
          { locale: 'fa', alias: 'سنگک' },
          { locale: 'en', alias: 'Sangak' },
        ],
        nutrients: [
          { nutrient_id: 'nut_energy', amount_per_100g: 259 },
          { nutrient_id: 'nut_protein', amount_per_100g: 9.2 },
          { nutrient_id: 'nut_carbohydrate', amount_per_100g: 52.4 },
          { nutrient_id: 'nut_fat_total', amount_per_100g: 1.5 },
          { nutrient_id: 'nut_fiber', amount_per_100g: 3.8 },
        ],
        servings: [
          {
            name_fa: 'یک کف دست',
            name_en: '1 Palm size (approx 10x10 cm)',
            weight_g: 30,
            household_unit: 'کف دست',
          },
          {
            name_fa: 'یک قرص کامل',
            name_en: '1 Full loaf',
            weight_g: 400,
            household_unit: 'قرص',
          },
        ],
      };

      const res = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(createPayload),
        },
        testEnv,
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as ApiResponse<{ food: FoodDetail }>;
      expect(data.success).toBe(true);
      expect(data.data.food.id).toBeTruthy();
      expect(data.data.food.name).toBe('نان سنگک سنتی');
      expect(data.data.food.foodType).toBe('generic');
      expect(data.data.food.barcode).toBe('6261234567890');
      expect(data.data.food.translations.length).toBe(2);
      expect(data.data.food.aliases.length).toBe(2);
      expect(data.data.food.nutrients.length).toBe(5);
      expect(data.data.food.servings.length).toBe(2);

      const foodId = data.data.food.id;

      // Verify Admin detail endpoint
      const detailRes = await app.request(
        `/api/v1/admin/foods/${foodId}?locale=en`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        testEnv,
      );
      expect(detailRes.status).toBe(200);
      const detailData = (await detailRes.json()) as ApiResponse<{ food: FoodDetail }>;
      expect(detailData.data.food.name).toBe('Traditional Sangak Bread');
      expect(detailData.data.food.category?.slug).toBe('grains-cereals');
    });

    it('rejects duplicate barcode with 409 CONFLICT and duplicate external ID with 409 CONFLICT', async () => {
      // 1. Create first food
      const res1 = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            barcode: '6269999999999',
            source_id: 'src_usda_fdc',
            external_id: 'fdc_998877',
            translations: [{ locale: 'fa', name: 'شیر کم چرب' }],
          }),
        },
        testEnv,
      );
      expect(res1.status).toBe(201);

      // 2. Duplicate Barcode
      const dupBarcodeRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            barcode: '6269999999999',
            translations: [{ locale: 'fa', name: 'شیر پرچرب' }],
          }),
        },
        testEnv,
      );
      expect(dupBarcodeRes.status).toBe(409);
      const dupBarcodeErr = (await dupBarcodeRes.json()) as ApiErrorResponse;
      expect(dupBarcodeErr.error.code).toBe('CONFLICT');

      // 3. Duplicate Source + External ID
      const dupSourceRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            source_id: 'src_usda_fdc',
            external_id: 'fdc_998877',
            translations: [{ locale: 'fa', name: 'شیر دیگری' }],
          }),
        },
        testEnv,
      );
      expect(dupSourceRes.status).toBe(409);
      const dupSourceErr = (await dupSourceRes.json()) as ApiErrorResponse;
      expect(dupSourceErr.error.code).toBe('CONFLICT');
    });

    it('rejects invalid nutrient IDs, negative amounts, and invalid serving weights with 400 VALIDATION_ERROR', async () => {
      // 1. Invalid Nutrient ID
      const badNutRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'تست ماده مغذی نامعتبر' }],
            nutrients: [{ nutrient_id: 'nut_non_existent', amount_per_100g: 50 }],
          }),
        },
        testEnv,
      );
      expect(badNutRes.status).toBe(400);

      // 2. Negative Nutrient Amount via API
      const negNutRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'تست منفی' }],
            nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: -5 }],
          }),
        },
        testEnv,
      );
      expect(negNutRes.status).toBe(400);

      // 3. Zero Serving Weight via API
      const zeroServingRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'تست سروینگ صفر' }],
            servings: [{ name_fa: 'سروینگ', name_en: 'Serving', weight_g: 0 }],
          }),
        },
        testEnv,
      );
      expect(zeroServingRes.status).toBe(400);
    });

    it('updates food and replaces translations, nutrients, and servings atomically', async () => {
      // Create initial food
      const createRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'ماست ساده' }],
            nutrients: [{ nutrient_id: 'nut_protein', amount_per_100g: 3.5 }],
            servings: [{ name_fa: 'یک پیاله', name_en: '1 Bowl', weight_g: 150 }],
          }),
        },
        testEnv,
      );
      const foodId = ((await createRes.json()) as ApiResponse<{ food: FoodDetail }>).data.food.id;

      // Update food
      const updateRes = await app.request(
        `/api/v1/admin/foods/${foodId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            food_type: 'branded',
            brand_name: 'دامداران',
            translations: [
              { locale: 'fa', name: 'ماست همزده پرچرب دامداران' },
              { locale: 'en', name: 'Damdaran Stirred Whole Yogurt' },
            ],
            nutrients: [
              { nutrient_id: 'nut_protein', amount_per_100g: 4.2 },
              { nutrient_id: 'nut_fat_total', amount_per_100g: 5.0 },
            ],
          }),
        },
        testEnv,
      );

      expect(updateRes.status).toBe(200);
      const updateData = (await updateRes.json()) as ApiResponse<{ food: FoodDetail }>;
      expect(updateData.data.food.foodType).toBe('branded');
      expect(updateData.data.food.brandName).toBe('دامداران');
      expect(updateData.data.food.name).toBe('ماست همزده پرچرب دامداران');
      expect(updateData.data.food.nutrients.length).toBe(2);
    });
  });

  describe('Public Endpoints, Categories, Nutrients & Soft Archive', () => {
    it('retrieves active categories and nutrient definitions', async () => {
      // 1. Categories
      const catRes = await app.request(
        '/api/v1/food-categories?locale=fa',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(catRes.status).toBe(200);
      const catData = (await catRes.json()) as ApiResponse<{ categories: FoodCategorySummary[] }>;
      expect(catData.data.categories.length).toBeGreaterThanOrEqual(7);
      expect(catData.data.categories.some((c) => c.slug === 'grains-cereals')).toBe(true);

      // 2. Nutrients
      const nutRes = await app.request(
        '/api/v1/nutrients',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(nutRes.status).toBe(200);
      const nutData = (await nutRes.json()) as ApiResponse<{ nutrients: NutrientDefinition[] }>;
      expect(nutData.data.nutrients.length).toBe(15);
      expect(nutData.data.nutrients.some((n) => n.code === 'energy' && n.unit === 'kcal')).toBe(
        true,
      );
    });

    it('soft archives food: excluded from public endpoints, but preserved in D1 and admin queries', async () => {
      // Create food
      const createRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            category_id: 'cat_fruits',
            translations: [{ locale: 'fa', name: 'پرتقال جنوب' }],
            nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: 47 }],
          }),
        },
        testEnv,
      );
      const foodId = ((await createRes.json()) as ApiResponse<{ food: FoodDetail }>).data.food.id;

      // Verify visible to public user
      const pubBefore = await app.request(
        `/api/v1/foods/${foodId}`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(pubBefore.status).toBe(200);

      // Admin archives food
      const archiveRes = await app.request(
        `/api/v1/admin/foods/${foodId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        testEnv,
      );
      expect(archiveRes.status).toBe(200);

      // Public detail returns 404 FOOD_NOT_FOUND
      const pubAfter = await app.request(
        `/api/v1/foods/${foodId}`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(pubAfter.status).toBe(404);
      const pubErr = (await pubAfter.json()) as ApiErrorResponse;
      expect(pubErr.error.code).toBe('FOOD_NOT_FOUND');

      // Public list excludes archived food
      const pubList = await app.request(
        '/api/v1/foods',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      const listData = (await pubList.json()) as ApiResponse<PaginatedResult<FoodSummary>>;
      expect(listData.data.items.some((f) => f.id === foodId)).toBe(false);

      // Admin list with status=archived includes the food
      const adminArchivedList = await app.request(
        '/api/v1/admin/foods?status=archived',
        { headers: { Authorization: `Bearer ${adminToken}` } },
        testEnv,
      );
      const adminData = (await adminArchivedList.json()) as ApiResponse<
        PaginatedResult<FoodSummary>
      >;
      expect(adminData.data.items.some((f) => f.id === foodId)).toBe(true);
    });
  });

  describe('Stable Cursor Pagination & Deterministic Locale Fallback', () => {
    it('paginates stably across multiple pages without gaps or duplicate records', async () => {
      // Create 5 foods sequentially
      for (let i = 1; i <= 5; i++) {
        await app.request(
          '/api/v1/admin/foods',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
              translations: [{ locale: 'fa', name: `غذای شماره ${i}` }],
              nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: 100 * i }],
            }),
          },
          testEnv,
        );
      }

      // Page 1 (limit: 2)
      const page1Res = await app.request(
        '/api/v1/foods?limit=2',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(page1Res.status).toBe(200);
      const page1 = (await page1Res.json()) as ApiResponse<PaginatedResult<FoodSummary>>;
      expect(page1.data.items.length).toBe(2);
      expect(page1.data.hasMore).toBe(true);
      expect(page1.data.nextCursor).toBeTruthy();

      // Page 2
      const page2Res = await app.request(
        `/api/v1/foods?limit=2&cursor=${page1.data.nextCursor}`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(page2Res.status).toBe(200);
      const page2 = (await page2Res.json()) as ApiResponse<PaginatedResult<FoodSummary>>;
      expect(page2.data.items.length).toBe(2);
      expect(page2.data.hasMore).toBe(true);
      expect(page2.data.nextCursor).toBeTruthy();

      // Ensure no overlapping IDs between page 1 and page 2
      const p1Ids = new Set(page1.data.items.map((i) => i.id));
      for (const item of page2.data.items) {
        expect(p1Ids.has(item.id)).toBe(false);
      }
    });

    it('falls back to Persian translation when requested English translation is absent', async () => {
      const createRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'کشک بادمجان خانگی' }],
          }),
        },
        testEnv,
      );
      const foodId = ((await createRes.json()) as ApiResponse<{ food: FoodDetail }>).data.food.id;

      // Request with locale=en must fallback to Persian name
      const enRes = await app.request(
        `/api/v1/foods/${foodId}?locale=en`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(enRes.status).toBe(200);
      const enData = (await enRes.json()) as ApiResponse<{ food: FoodDetail }>;
      expect(enData.data.food.name).toBe('کشک بادمجان خانگی');
    });
  });

  describe('RBAC & Security Boundaries', () => {
    it('returns 401 for unauthenticated food requests', async () => {
      const res = await app.request('/api/v1/foods', {}, testEnv);
      expect(res.status).toBe(401);
    });

    it('returns 403 FORBIDDEN when regular user tries to access admin food endpoints', async () => {
      const res = await app.request(
        '/api/v1/admin/foods',
        {
          headers: { Authorization: `Bearer ${userToken}` },
        },
        testEnv,
      );
      expect(res.status).toBe(403);
    });

    it('enforces CSRF Origin/Referer check on mutating cookie-authenticated admin requests', async () => {
      const res = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `nutriai_session=${adminToken}`,
            Origin: 'https://evil-untrusted-site.com',
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'غذای هک شده' }],
          }),
        },
        { ...testEnv, ALLOWED_ORIGINS: 'http://localhost:3000' },
      );
      expect(res.status).toBe(403);
    });
  });
});
