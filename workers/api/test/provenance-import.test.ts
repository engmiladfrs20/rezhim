import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import type { ProvidedEnv } from 'cloudflare:workers';
import { app } from '../src/app';
import './apply-migrations';
import { FoodImporterService } from '../src/services/food-importer.service';
import { FoodImportLogRepository } from '../src/db/food-import-log.repository';
import type {
  FoodDatasetFile,
  FoodDatasetItem,
  ApiResponse,
  FoodDetail,
  FoodSummary,
  PaginatedResult,
} from '@nutriai/types';
import {
  openIranianFoods,
  openIranianSourceManifest,
  fctManifest,
  fctTemplateFoods,
} from './dataset-fixtures';

const testEnv = env as ProvidedEnv;

describe('Phase 5 — Iranian Food Database & Provenance Pipeline Tests', () => {
  let importer: FoodImporterService;
  let adminToken: string;

  beforeEach(async () => {
    importer = new FoodImporterService(testEnv.DB!);
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();

    // Register & login admin user for authenticated endpoints
    const adminEmail = `admin_prov_${crypto.randomUUID()}@nutriai.persia`;
    const regRes = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password: 'Password123!',
          display_name: 'Provenance Admin',
          locale: 'fa',
        }),
      },
      testEnv,
    );
    expect(regRes.status).toBe(201);

    await db
      .prepare('UPDATE users SET role = ? WHERE email_normalized = ?')
      .bind('admin', adminEmail.toLowerCase().trim())
      .run();

    const tokenRes = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password: 'Password123!',
        }),
      },
      testEnv,
    );
    expect(tokenRes.status).toBe(200);
    const tokenData = (await tokenRes.json()) as ApiResponse<{ token: string }>;
    adminToken = tokenData.data.token;
  });

  it('verifies manifest and checksum validation against dataset content', async () => {
    const rawContent = JSON.stringify(openIranianFoods);
    const calculatedChecksum = await importer.computeChecksum(rawContent);

    // Dynamic manifest with matching checksum
    const validDataset: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: calculatedChecksum,
      },
      foods: openIranianFoods,
    };

    const valResult = await importer.validateDataset(validDataset, rawContent);
    expect(valResult.valid).toBe(true);
    expect(valResult.errors).toHaveLength(0);

    // Tampered checksum
    const tamperedDataset: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: '0000000000000000000000000000000000000000000000000000000000000000',
      },
      foods: openIranianFoods,
    };

    const badVal = await importer.validateDataset(tamperedDataset, rawContent);
    expect(badVal.valid).toBe(false);
    expect(badVal.errors.some((e) => e.includes('checksum mismatch'))).toBe(true);
  });

  it('keeps only exact USDA commodities active and all unsupported Iranian identities unpublished', () => {
    const activeFoods = openIranianFoods.filter((food) => food.status === 'active');
    const draftFoods = openIranianFoods.filter((food) => food.status === 'draft');

    expect(activeFoods).toHaveLength(10);
    expect(draftFoods).toHaveLength(20);
    expect(activeFoods.map((food) => food.external_id).sort()).toEqual(
      [
        'item_chicken_breast_grilled',
        'item_chickpeas_cooked',
        'item_dates_deglet_noor',
        'item_ground_beef_patty_cooked',
        'item_lentils_cooked',
        'item_parsley_fresh',
        'item_pomegranate_raw',
        'item_tea_black_brewed',
        'item_walnuts_raw',
        'item_yogurt_whole_milk',
      ].sort(),
    );

    for (const food of activeFoods) {
      for (const record of [...(food.nutrients ?? []), ...(food.servings ?? [])]) {
        expect(record.source_id).toBe('src_usda_fdc');
        expect(record.external_id).toBeTruthy();
        expect(record.source_url).toBe(
          `https://fdc.nal.usda.gov/food-search/?query=${record.external_id}`,
        );
        expect(record.citation).toContain('USDA');
        expect(record.dataset_version).toBeTruthy();
        expect(record.method).toBe('database');
        expect(record.retrieved_at).toMatch(/Z$/);
        expect(record.license).toContain('Public Domain');
      }
    }

    for (const food of draftFoods) {
      expect(food.nutrients ?? []).toHaveLength(0);
      expect(food.servings ?? []).toHaveLength(0);
    }
  });

  it('rejects sources with restricted redistribution policy from unauthenticated/direct production ingestion', async () => {
    const restrictedDataset: FoodDatasetFile = {
      manifest: fctManifest,
      foods: fctTemplateFoods,
    };

    // 1. Default validation must reject
    const valResult = await importer.validateDataset(restrictedDataset);
    expect(valResult.valid).toBe(false);
    expect(valResult.errors.some((e) => e.includes('disallows redistribution'))).toBe(true);

    // 2. Explicit allowLicensedLocal option permits local ingestion
    const valLocalResult = await importer.validateDataset(restrictedDataset, undefined, {
      allowLicensedLocal: true,
      environment: 'test',
    });
    expect(valLocalResult.valid).toBe(true);

    const valProductionResult = await importer.validateDataset(restrictedDataset, undefined, {
      allowLicensedLocal: true,
      environment: 'production',
    });
    expect(valProductionResult.valid).toBe(false);
  });

  it('imports the authentic Iranian foods baseline idempotently and logs the run in food_import_logs', async () => {
    const rawContent = JSON.stringify(openIranianFoods);
    const calculatedChecksum = await importer.computeChecksum(rawContent);

    const validDataset: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: calculatedChecksum,
      },
      foods: openIranianFoods,
    };

    // 1. Initial Import Run
    const run1 = await importer.runPipeline(validDataset, rawContent, 'import', {
      executedBy: 'test-runner',
    });
    expect(run1.status, run1.errors.join('; ')).toBe('success');
    expect(run1.insertedCount).toBe(openIranianFoods.length);
    expect(run1.updatedCount).toBe(0);
    expect(run1.unchangedCount).toBe(0);
    expect(run1.failedCount).toBe(0);

    // Verify import log record in D1
    const logRepo = new FoodImportLogRepository(testEnv.DB!);
    const logs = await logRepo.findBySourceId('src_open_iranian_foods');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]?.status).toBe('success');
    expect(logs[0]?.inserted_count).toBe(openIranianFoods.length);

    // 2. Re-import run (Idempotency assertion)
    const run2 = await importer.runPipeline(validDataset, rawContent, 'import', {
      executedBy: 'test-runner',
    });
    expect(run2.status).toBe('success');
    expect(run2.insertedCount).toBe(0);
    expect(run2.updatedCount).toBe(0);
    expect(run2.unchangedCount).toBe(openIranianFoods.length);
    expect(run2.failedCount).toBe(0);

    // Direct D1 query asserting no duplicate items were inserted
    const d1LentilCount = await testEnv
      .DB!.prepare("SELECT COUNT(*) as cnt FROM foods WHERE external_id = 'item_lentils_cooked'")
      .first<{ cnt: number }>();
    expect(d1LentilCount?.cnt).toBe(1);
  });

  it('proves dataset-level atomicity on mid-batch constraint failure with zero partial writes in D1', async () => {
    const db = testEnv.DB!;

    // Pre-insert an existing food with a specific unique barcode
    await db
      .prepare(
        `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at)
         VALUES ('food_existing_barcode', 'cat_legumes', 'generic', NULL, '6260000000001', 'active', 'src_open_iranian_foods', 'item_existing_colliding', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .run();

    // Prepare a batch where Item 1 is valid, and Item 2 has the colliding barcode
    const atomicFoods: FoodDatasetItem[] = [
      {
        external_id: 'item_atomic_valid_1',
        food_type: 'generic',
        status: 'draft',
        source_id: 'src_open_iranian_foods',
        translations: [{ locale: 'fa', name: 'غذای آزمون اتمیک اول' }],
      },
      {
        external_id: 'item_atomic_failing_2',
        food_type: 'generic',
        barcode: '6260000000001',
        status: 'draft',
        source_id: 'src_open_iranian_foods',
        translations: [{ locale: 'fa', name: 'غذای آزمون اتمیک دوم شکست' }],
      },
    ];
    const atomicRaw = JSON.stringify(atomicFoods);
    const atomicityBatch: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: await importer.computeChecksum(atomicRaw),
      },
      foods: atomicFoods,
    };

    // Run pipeline
    const importRes = await importer.runPipeline(atomicityBatch, atomicRaw, 'import', {
      executedBy: 'atomicity-test',
    });
    expect(importRes.status).toBe('failed');
    expect(importRes.errors.length).toBeGreaterThan(0);
    expect(importRes.errors[0]).not.toContain('SQLITE_'); // Proves no raw SQL/SQLite internal text leak

    // Assert that Item 1 was NOT committed to D1 (proves full transaction rollback!)
    const item1Record = await db
      .prepare("SELECT * FROM foods WHERE external_id = 'item_atomic_valid_1'")
      .first();
    expect(item1Record).toBeNull();

    // Assert that Item 2 was NOT committed to D1
    const item2Record = await db
      .prepare("SELECT * FROM foods WHERE external_id = 'item_atomic_failing_2'")
      .first();
    expect(item2Record).toBeNull();

    // Assert that success log was NOT committed
    const successLogs = await db
      .prepare(
        "SELECT * FROM food_import_logs WHERE source_id = 'src_open_iranian_foods' AND status = 'success' AND executed_by = 'atomicity-test'",
      )
      .all();
    expect(successLogs.results.length).toBe(0);

    // Assert that failed import log was recorded safely
    const failedLogs = await db
      .prepare(
        "SELECT * FROM food_import_logs WHERE source_id = 'src_open_iranian_foods' AND status = 'failed' AND executed_by = 'atomicity-test'",
      )
      .all<{ id: string; error_summary: string }>();
    expect(failedLogs.results.length).toBeGreaterThan(0);
    expect(failedLogs.results[0]?.error_summary).toContain('constraint');
  });

  it('rejects invalid batches (negative nutrients, zero servings, bad categories, duplicate aliases) with atomic rollback', async () => {
    const invalidBatch: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: 'a'.repeat(64),
      },
      foods: [
        {
          external_id: 'bad_item_negative_nutrient',
          food_type: 'generic',
          status: 'draft',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'غذای نامعتبر' }],
          nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: -50 }],
        },
        {
          external_id: 'bad_item_zero_serving',
          food_type: 'generic',
          status: 'draft',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'غذای سروینگ نامعتبر' }],
          servings: [{ name_fa: 'صفر گرم', name_en: 'Zero', weight_g: 0 }],
        },
        {
          external_id: 'bad_item_cat',
          category_id: 'cat_non_existent_9999',
          food_type: 'generic',
          status: 'draft',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'دسته‌بندی نامعتبر' }],
        },
      ] as FoodDatasetItem[],
    };

    const valRes = await importer.validateDataset(invalidBatch);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.length).toBeGreaterThanOrEqual(3);
    expect(
      valRes.errors.some(
        (e) => e.includes('Nutrient amount cannot be negative') || e.includes('negative nutrient'),
      ),
    ).toBe(true);
    expect(
      valRes.errors.some(
        (e) =>
          e.includes('Serving weight must be strictly greater than 0') ||
          e.includes('zero or negative serving'),
      ),
    ).toBe(true);
    expect(valRes.errors.some((e) => e.includes('non-existent category'))).toBe(true);

    const importRes = await importer.runPipeline(invalidBatch, undefined, 'import');
    expect(importRes.status).toBe('failed');

    // Direct D1 query: verify zero records from the invalid batch exist
    const badRecord = await testEnv
      .DB!.prepare("SELECT * FROM foods WHERE external_id = 'bad_item_negative_nutrient'")
      .first();
    expect(badRecord).toBeNull();
  });

  it('detects Persian alias collisions across items during validation', async () => {
    const aliasCollisionBatch: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: 'a'.repeat(64),
      },
      foods: [
        {
          external_id: 'item_ghormeh_1',
          food_type: 'generic',
          status: 'draft',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'قورمه سبزی نوع ۱' }],
          aliases: [{ locale: 'fa', alias: 'قورمه‌سبزی سنتی' }],
        },
        {
          external_id: 'item_ghormeh_2',
          food_type: 'generic',
          status: 'draft',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'قورمه سبزی نوع ۲' }],
          aliases: [{ locale: 'fa', alias: 'قورمه سبزي سنّتي' }], // Collides after Persian normalization
        },
      ] as FoodDatasetItem[],
    };

    const valRes = await importer.validateDataset(aliasCollisionBatch);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some((e) => e.includes('collides with item'))).toBe(true);
  });

  it('retrieves authentic Iranian food catalog via public and admin APIs in Persian and English with granular provenance', async () => {
    // Import authentic dataset
    const rawContent = JSON.stringify(openIranianFoods);
    const calculatedChecksum = await importer.computeChecksum(rawContent);
    const validDataset: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: calculatedChecksum,
      },
      foods: openIranianFoods,
    };
    const importRes = await importer.runPipeline(validDataset, rawContent, 'import');
    expect(importRes.status, importRes.errors.join('; ')).toBe('success');

    // 1. Query Public Foods List in Persian (fa)
    const publicListFaRes = await app.request(
      '/api/v1/foods?locale=fa&limit=50',
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      testEnv,
    );
    expect(publicListFaRes.status).toBe(200);
    const publicFaData = (await publicListFaRes.json()) as ApiResponse<
      PaginatedResult<FoodSummary>
    >;
    expect(publicFaData.data.items.length).toBe(11); // 1 seed + 10 imported active items

    const lentilFa = publicFaData.data.items.find((f) => f.name.includes('عدس'));
    expect(lentilFa).toBeDefined();
    expect(lentilFa?.locale).toBe('fa');
    expect(lentilFa?.resolvedLocale).toBe('fa');
    expect(lentilFa?.status).toBe('active');
    expect(lentilFa?.energyKcal).toBe(116);

    // 2. Query Public Foods List in English (en)
    const publicListEnRes = await app.request(
      '/api/v1/foods?locale=en&limit=50',
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      testEnv,
    );
    expect(publicListEnRes.status).toBe(200);
    const publicEnData = (await publicListEnRes.json()) as ApiResponse<
      PaginatedResult<FoodSummary>
    >;

    const lentilEn = publicEnData.data.items.find((f) => f.id === lentilFa?.id);
    expect(lentilEn).toBeDefined();
    expect(lentilEn?.locale).toBe('en');
    expect(lentilEn?.resolvedLocale).toBe('en');
    expect(lentilEn?.name).toContain('Lentils');

    // 3. Draft filtering: Draft composite recipes are EXCLUDED from public list
    const draftInPublic = publicFaData.data.items.find(
      (f) => f.name.includes('پیش‌نویس') || f.status === 'draft',
    );
    expect(draftInPublic).toBeUndefined();

    // 4. Admin List queries all items including draft status
    const adminDraftRes = await app.request(
      '/api/v1/admin/foods?status=draft&limit=50',
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      testEnv,
    );
    expect(adminDraftRes.status).toBe(200);
    const adminDraftData = (await adminDraftRes.json()) as ApiResponse<
      PaginatedResult<FoodSummary>
    >;
    expect(adminDraftData.data.items.length).toBe(20);

    const ghormehDraft = adminDraftData.data.items.find((f) => f.name.includes('قورمه'));
    expect(ghormehDraft).toBeDefined();
    expect(ghormehDraft?.status).toBe('draft');

    // 5. Query Full Food Detail with Servings, Nutrients & Granular Provenance
    const detailRes = await app.request(
      `/api/v1/foods/${lentilFa!.id}?locale=fa`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      testEnv,
    );
    expect(detailRes.status).toBe(200);
    const detailData = (await detailRes.json()) as ApiResponse<{ food: FoodDetail }>;
    expect(detailData.data.food.servings.length).toBeGreaterThanOrEqual(1);
    expect(detailData.data.food.nutrients.length).toBeGreaterThanOrEqual(4);
    expect(detailData.data.food.source?.code).toBe('open_iranian_foods');
    expect(detailData.data.food.externalId).toBe('item_lentils_cooked');

    // Granular provenance assertions
    const energyNutrient = detailData.data.food.nutrients.find(
      (n) => n.nutrientId === 'nut_energy',
    );
    expect(energyNutrient).toBeDefined();
    expect(energyNutrient?.sourceId).toBe('src_usda_fdc');
    expect(energyNutrient?.externalId).toBe('172420');
    expect(energyNutrient?.method).toBe('database');
    expect(energyNutrient?.sourceUrl).toContain('fdc.nal.usda.gov');
    expect(energyNutrient?.citation).toContain('USDA FoodData Central');

    const cupServing = detailData.data.food.servings.find((s) => s.nameFa.includes('لیوان'));
    expect(cupServing).toBeDefined();
    expect(cupServing?.sourceId).toBe('src_usda_fdc');
    expect(cupServing?.externalId).toBe('172420_portion_1');
    expect(cupServing?.method).toBe('database');
  });
});
