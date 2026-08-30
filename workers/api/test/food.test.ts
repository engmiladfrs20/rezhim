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

const STRICT_RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

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

  describe('D1 Database Integrity, Constraints & Strict RFC3339 Seeds', () => {
    it('verifies that all seed timestamps in nutrient_definitions, categories, and sources are strict RFC3339 UTC', async () => {
      const db = testEnv.DB!;

      const [nuts, cats, catTrans, sources] = await Promise.all([
        db
          .prepare('SELECT created_at, updated_at FROM nutrient_definitions')
          .all<{ created_at: string; updated_at: string }>(),
        db
          .prepare('SELECT created_at, updated_at FROM food_categories')
          .all<{ created_at: string; updated_at: string }>(),
        db
          .prepare('SELECT created_at, updated_at FROM food_category_translations')
          .all<{ created_at: string; updated_at: string }>(),
        db
          .prepare('SELECT created_at, updated_at FROM food_sources')
          .all<{ created_at: string; updated_at: string }>(),
      ]);

      for (const row of nuts.results || []) {
        expect(STRICT_RFC3339_REGEX.test(row.created_at)).toBe(true);
        expect(STRICT_RFC3339_REGEX.test(row.updated_at)).toBe(true);
      }
      for (const row of cats.results || []) {
        expect(STRICT_RFC3339_REGEX.test(row.created_at)).toBe(true);
        expect(STRICT_RFC3339_REGEX.test(row.updated_at)).toBe(true);
      }
      for (const row of catTrans.results || []) {
        expect(STRICT_RFC3339_REGEX.test(row.created_at)).toBe(true);
        expect(STRICT_RFC3339_REGEX.test(row.updated_at)).toBe(true);
      }
      for (const row of sources.results || []) {
        expect(STRICT_RFC3339_REGEX.test(row.created_at)).toBe(true);
        expect(STRICT_RFC3339_REGEX.test(row.updated_at)).toBe(true);
      }
    });

    it('enforces check constraints preventing negative nutrients and zero/negative serving weights in D1', async () => {
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

  describe('Admin Food CRUD, Atomic Operations & Edit Data Loss Prevention', () => {
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
      expect(data.data.food.resolvedLocale).toBe('fa');
      expect(data.data.food.foodType).toBe('generic');
      expect(data.data.food.barcode).toBe('6261234567890');
      expect(data.data.food.translations.length).toBe(2);
      expect(data.data.food.aliases.length).toBe(2);
      expect(data.data.food.nutrients.length).toBe(5);
      expect(data.data.food.servings.length).toBe(2);
    });

    it('proves name-only PATCH preserves all aliases, micronutrients (>5), and multiple servings without data loss', async () => {
      // 1. Create rich food with 2 aliases, 7 nutrients (macros + iron + calcium), and 2 servings
      const initialPayload = {
        category_id: 'cat_grains',
        food_type: 'generic',
        translations: [{ locale: 'fa', name: 'نان سنگک کنجدی' }],
        aliases: [
          { locale: 'fa', alias: 'سنگک کنجددار' },
          { locale: 'en', alias: 'Sesame Sangak' },
        ],
        nutrients: [
          { nutrient_id: 'nut_energy', amount_per_100g: 270 },
          { nutrient_id: 'nut_protein', amount_per_100g: 9.5 },
          { nutrient_id: 'nut_carbohydrate', amount_per_100g: 50 },
          { nutrient_id: 'nut_fat_total', amount_per_100g: 3.5 },
          { nutrient_id: 'nut_fiber', amount_per_100g: 4.0 },
          { nutrient_id: 'nut_iron', amount_per_100g: 2.1 },
          { nutrient_id: 'nut_calcium', amount_per_100g: 45 },
        ],
        servings: [
          { name_fa: 'یک کف دست', name_en: '1 Palm size', weight_g: 30, household_unit: 'کف دست' },
          { name_fa: 'یک قرص کامل', name_en: '1 Loaf', weight_g: 420, household_unit: 'قرص' },
        ],
      };

      const createRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(initialPayload),
        },
        testEnv,
      );
      const foodId = ((await createRes.json()) as ApiResponse<{ food: FoodDetail }>).data.food.id;

      // 2. Perform name-only PATCH update without sending nutrients, aliases, or servings
      const patchRes = await app.request(
        `/api/v1/admin/foods/${foodId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'نان سنگک اعلا دو رو کنجد' }],
          }),
        },
        testEnv,
      );

      expect(patchRes.status).toBe(200);

      // 3. Verify that all 2 aliases, all 7 nutrients, and both servings are completely intact
      const detailRes = await app.request(
        `/api/v1/admin/foods/${foodId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
        testEnv,
      );
      const detail = ((await detailRes.json()) as ApiResponse<{ food: FoodDetail }>).data.food;

      expect(detail.name).toBe('نان سنگک اعلا دو رو کنجد');
      expect(detail.aliases.length).toBe(2);
      expect(detail.aliases.some((a) => a.alias === 'سنگک کنجددار')).toBe(true);
      expect(detail.nutrients.length).toBe(7);
      expect(detail.nutrients.some((n) => n.code === 'iron' && n.amountPer100g === 2.1)).toBe(true);
      expect(detail.nutrients.some((n) => n.code === 'calcium' && n.amountPer100g === 45)).toBe(
        true,
      );
      expect(detail.servings.length).toBe(2);
      expect(detail.servings[1]?.weightG).toBe(420);
    });

    it('normalizes barcodes with Persian/Arabic digits and separators to canonical format, and rejects duplicates with 409 CONFLICT', async () => {
      // 1. Create with Persian digits and hyphens: "۶۲۶-۰۰۰۰-۸۸۸۸"
      const res1 = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            barcode: '۶۲۶-۰۰۰۰-۸۸۸۸',
            translations: [{ locale: 'fa', name: 'دوغ نعنایی' }],
          }),
        },
        testEnv,
      );
      expect(res1.status).toBe(201);
      const food1 = ((await res1.json()) as ApiResponse<{ food: FoodDetail }>).data.food;
      expect(food1.barcode).toBe('62600008888');

      // 2. Attempt to create another food with same canonical barcode formatted with spaces: "626 0000 8888"
      const res2 = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            barcode: '626 0000 8888',
            translations: [{ locale: 'fa', name: 'دوغ آویشن' }],
          }),
        },
        testEnv,
      );
      expect(res2.status).toBe(409);
      const errData = (await res2.json()) as ApiErrorResponse;
      expect(errData.error.code).toBe('CONFLICT');
      expect(errData.error.message).toContain('barcode');
    });

    it('rejects duplicate nested items in payload with 400 VALIDATION_ERROR', async () => {
      // 1. Duplicate Locale in translations
      const dupLocaleRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [
              { locale: 'fa', name: 'ماست ۱' },
              { locale: 'fa', name: 'ماست ۲' },
            ],
          }),
        },
        testEnv,
      );
      expect(dupLocaleRes.status).toBe(400);

      // 2. Duplicate Nutrient ID
      const dupNutRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'تست' }],
            nutrients: [
              { nutrient_id: 'nut_energy', amount_per_100g: 100 },
              { nutrient_id: 'nut_energy', amount_per_100g: 200 },
            ],
          }),
        },
        testEnv,
      );
      expect(dupNutRes.status).toBe(400);

      // 3. Duplicate Alias for same locale
      const dupAliasRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'تست' }],
            aliases: [
              { locale: 'fa', alias: 'سیب' },
              { locale: 'fa', alias: 'سیب' },
            ],
          }),
        },
        testEnv,
      );
      expect(dupAliasRes.status).toBe(400);

      // 4. Duplicate Serving Name
      const dupServRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            translations: [{ locale: 'fa', name: 'تست' }],
            servings: [
              { name_fa: 'یک لیوان', name_en: '1 Cup', weight_g: 240 },
              { name_fa: 'یک لیوان', name_en: '1 Glass', weight_g: 250 },
            ],
          }),
        },
        testEnv,
      );
      expect(dupServRes.status).toBe(400);
    });

    it('enforces model rules: branded requires brand_name, external_id requires source_id, parent category validation', async () => {
      // 1. Branded without brand_name -> 400
      const noBrandRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            food_type: 'branded',
            brand_name: '',
            translations: [{ locale: 'fa', name: 'پنیر سفید' }],
          }),
        },
        testEnv,
      );
      expect(noBrandRes.status).toBe(400);

      // 2. external_id without source_id -> 400
      const noSourceRes = await app.request(
        '/api/v1/admin/foods',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            external_id: 'ext_9999',
            translations: [{ locale: 'fa', name: 'پنیر تبریز' }],
          }),
        },
        testEnv,
      );
      expect(noSourceRes.status).toBe(400);

      // 3. Non-existent parent category when creating category -> 400
      const badParentCatRes = await app.request(
        '/api/v1/admin/foods/categories',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            slug: 'sub-dairy-invalid',
            parent_id: 'cat_non_existent_999',
            translations: [{ locale: 'fa', name: 'زیردسته نامعتبر' }],
          }),
        },
        testEnv,
      );
      expect(badParentCatRes.status).toBe(400);
    });

    it('handles concurrent duplicate creation gracefully returning 409 without 500 or leaking SQL text', async () => {
      const payload = {
        barcode: '6265555555555',
        translations: [{ locale: 'fa', name: 'آبمیوه طبیعی' }],
      };

      const [res1, res2] = await Promise.all([
        app.request(
          '/api/v1/admin/foods',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(payload),
          },
          testEnv,
        ),
        app.request(
          '/api/v1/admin/foods',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(payload),
          },
          testEnv,
        ),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      const errBody = (await conflictRes.json()) as ApiErrorResponse;
      expect(errBody.error.code).toBe('CONFLICT');
      expect(errBody.error.message).not.toContain('SQLite');
      expect(errBody.error.message).not.toContain('D1_ERROR');

      // Verify D1 atomicity: exactly 1 record exists
      const countRes = await testEnv
        .DB!.prepare("SELECT COUNT(*) as cnt FROM foods WHERE barcode = '6265555555555'")
        .first<{ cnt: number }>();
      expect(countRes?.cnt).toBe(1);
    });
  });

  describe('Public Endpoints, Categories, Nutrients & Soft Archive', () => {
    it('retrieves active categories and nutrient definitions', async () => {
      const catRes = await app.request(
        '/api/v1/food-categories?locale=fa',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(catRes.status).toBe(200);
      const catData = (await catRes.json()) as ApiResponse<{ categories: FoodCategorySummary[] }>;
      expect(catData.data.categories.length).toBeGreaterThanOrEqual(7);
      expect(catData.data.categories[0]?.resolvedLocale).toBe('fa');

      const nutRes = await app.request(
        '/api/v1/nutrients',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(nutRes.status).toBe(200);
      const nutData = (await nutRes.json()) as ApiResponse<{ nutrients: NutrientDefinition[] }>;
      expect(nutData.data.nutrients.length).toBe(15);
    });

    it('soft archives food: excluded from public endpoints, but preserved in D1 and admin queries', async () => {
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

      const archiveRes = await app.request(
        `/api/v1/admin/foods/${foodId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        testEnv,
      );
      expect(archiveRes.status).toBe(200);

      const pubAfter = await app.request(
        `/api/v1/foods/${foodId}`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(pubAfter.status).toBe(404);
      const pubErr = (await pubAfter.json()) as ApiErrorResponse;
      expect(pubErr.error.code).toBe('FOOD_NOT_FOUND');

      const pubList = await app.request(
        '/api/v1/foods',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      const listData = (await pubList.json()) as ApiResponse<PaginatedResult<FoodSummary>>;
      expect(listData.data.items.some((f) => f.id === foodId)).toBe(false);

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

  describe('Cursor Codec, Pagination Stability & Locale Fallback', () => {
    it('paginates stably across multiple pages without gaps or duplicate records using versioned Base64URL cursor', async () => {
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
              translations: [{ locale: 'fa', name: `غذای تست ${i}` }],
              nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: 100 * i }],
            }),
          },
          testEnv,
        );
      }

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

      const page2Res = await app.request(
        `/api/v1/foods?limit=2&cursor=${page1.data.nextCursor}`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(page2Res.status).toBe(200);
      const page2 = (await page2Res.json()) as ApiResponse<PaginatedResult<FoodSummary>>;
      expect(page2.data.items.length).toBe(2);

      const p1Ids = new Set(page1.data.items.map((i) => i.id));
      for (const item of page2.data.items) {
        expect(p1Ids.has(item.id)).toBe(false);
      }
    });

    it('rejects malformed, tampered or invalid-version cursors with 400 INVALID_CURSOR', async () => {
      // 1. Invalid Base64
      const res1 = await app.request(
        '/api/v1/foods?cursor=invalid_base64!!!',
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(res1.status).toBe(400);
      const err1 = (await res1.json()) as ApiErrorResponse;
      expect(err1.error.code).toBe('INVALID_CURSOR');

      // 2. Tampered invalid date in cursor
      const tamperedDate = btoa('v1:not-a-date:food_123');
      const res2 = await app.request(
        `/api/v1/foods?cursor=${tamperedDate}`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(res2.status).toBe(400);
      const err2 = (await res2.json()) as ApiErrorResponse;
      expect(err2.error.code).toBe('INVALID_CURSOR');

      // 3. Unsupported cursor version (v2)
      const unsupportedVer = btoa('v2:2026-08-30T10:00:00.000Z:food_123');
      const res3 = await app.request(
        `/api/v1/admin/foods?cursor=${unsupportedVer}`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
        testEnv,
      );
      expect(res3.status).toBe(400);
      const err3 = (await res3.json()) as ApiErrorResponse;
      expect(err3.error.code).toBe('INVALID_CURSOR');
    });

    it('accurately resolves locale and returns resolvedLocale "fa" when requested "en" has no English translation', async () => {
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

      const enRes = await app.request(
        `/api/v1/foods/${foodId}?locale=en`,
        { headers: { Authorization: `Bearer ${userToken}` } },
        testEnv,
      );
      expect(enRes.status).toBe(200);
      const enData = (await enRes.json()) as ApiResponse<{ food: FoodDetail }>;
      expect(enData.data.food.name).toBe('کشک بادمجان خانگی');
      expect(enData.data.food.resolvedLocale).toBe('fa');
      expect(enData.data.food.locale).toBe('fa');
      expect(enData.data.food.requestedLocale).toBe('en');
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
