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

  it('rejects sources with restricted redistribution policy from unauthenticated/direct production ingestion', async () => {
    const restrictedDataset: FoodDatasetFile = {
      manifest: fctManifest,
      foods: fctTemplateFoods,
    };

    const valResult = await importer.validateDataset(restrictedDataset);
    expect(valResult.valid).toBe(false);
    expect(valResult.errors.some((e) => e.includes('disallows redistribution'))).toBe(true);
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
    const run1 = await importer.runPipeline(validDataset, rawContent, 'import', 'test-runner');
    expect(run1.status).toBe('success');
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
    const run2 = await importer.runPipeline(validDataset, rawContent, 'import', 'test-runner');
    expect(run2.status).toBe('success');
    expect(run2.insertedCount).toBe(0);
    expect(run2.updatedCount).toBe(0);
    expect(run2.unchangedCount).toBe(openIranianFoods.length);
    expect(run2.failedCount).toBe(0);

    // Direct D1 query asserting no duplicate items were inserted
    const d1SangakCount = await testEnv
      .DB!.prepare("SELECT COUNT(*) as cnt FROM foods WHERE external_id = 'item_sangak'")
      .first<{ cnt: number }>();
    expect(d1SangakCount?.cnt).toBe(1);
  });

  it('detects and counts partial updates vs unchanged records accurately', async () => {
    const rawContent = JSON.stringify(openIranianFoods);
    const calculatedChecksum = await importer.computeChecksum(rawContent);

    const validDataset: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: calculatedChecksum,
      },
      foods: openIranianFoods,
    };

    // Ensure initial import
    await importer.runPipeline(validDataset, rawContent, 'import');

    // Modify a single item's translation
    const modifiedFoods = JSON.parse(JSON.stringify(openIranianFoods)) as FoodDatasetItem[];
    const firstFood = modifiedFoods[0];
    if (firstFood && firstFood.translations[0]) {
      firstFood.translations[0].description = 'توضیحات به‌روزشده نان سنگک سنتی';
    }

    const modRawContent = JSON.stringify(modifiedFoods);
    const modChecksum = await importer.computeChecksum(modRawContent);
    const modifiedDataset: FoodDatasetFile = {
      manifest: {
        ...openIranianSourceManifest,
        sha256Checksum: modChecksum,
      },
      foods: modifiedFoods,
    };

    const runMod = await importer.runPipeline(modifiedDataset, modRawContent, 'import');
    expect(runMod.status).toBe('success');
    expect(runMod.insertedCount).toBe(0);
    expect(runMod.updatedCount).toBe(1);
    expect(runMod.unchangedCount).toBe(openIranianFoods.length - 1);
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
          status: 'active',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'غذای نامعتبر' }],
          nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: -50 }],
        },
        {
          external_id: 'bad_item_zero_serving',
          food_type: 'generic',
          status: 'active',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'غذای سروینگ نامعتبر' }],
          servings: [{ name_fa: 'صفر گرم', name_en: 'Zero', weight_g: 0 }],
        },
        {
          external_id: 'bad_item_cat',
          category_id: 'cat_non_existent_9999',
          food_type: 'generic',
          status: 'active',
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
          status: 'active',
          source_id: 'src_open_iranian_foods',
          translations: [{ locale: 'fa', name: 'قورمه سبزی نوع ۱' }],
          aliases: [{ locale: 'fa', alias: 'قورمه‌سبزی سنتی' }],
        },
        {
          external_id: 'item_ghormeh_2',
          food_type: 'generic',
          status: 'active',
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

  it('retrieves authentic Iranian food catalog via public and admin APIs in Persian and English with resolvedLocale', async () => {
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
    await importer.runPipeline(validDataset, rawContent, 'import');

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
    expect(publicFaData.data.items.length).toBeGreaterThan(0);

    const sangakFa = publicFaData.data.items.find((f) => f.name.includes('سنگک'));
    expect(sangakFa).toBeDefined();
    expect(sangakFa?.locale).toBe('fa');
    expect(sangakFa?.resolvedLocale).toBe('fa');
    expect(sangakFa?.status).toBe('active');
    expect(sangakFa?.energyKcal).toBe(259);

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

    const sangakEn = publicEnData.data.items.find((f) => f.id === sangakFa?.id);
    expect(sangakEn).toBeDefined();
    expect(sangakEn?.locale).toBe('en');
    expect(sangakEn?.resolvedLocale).toBe('en');
    expect(sangakEn?.name).toContain('Sangak');

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
    expect(adminDraftData.data.items.length).toBeGreaterThanOrEqual(4);
    const ghormehDraft = adminDraftData.data.items.find((f) => f.name.includes('قورمه سبزی'));
    expect(ghormehDraft).toBeDefined();
    expect(ghormehDraft?.status).toBe('draft');

    // 5. Query Full Food Detail with Servings & Nutrients
    const detailRes = await app.request(
      `/api/v1/foods/${sangakFa!.id}?locale=fa`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      testEnv,
    );
    expect(detailRes.status).toBe(200);
    const detailData = (await detailRes.json()) as ApiResponse<{ food: FoodDetail }>;
    expect(detailData.data.food.servings.length).toBeGreaterThanOrEqual(2);
    expect(detailData.data.food.nutrients.length).toBeGreaterThanOrEqual(7);
    expect(detailData.data.food.source?.code).toBe('open_iranian_foods');
    expect(detailData.data.food.externalId).toBe('item_sangak');
  });
});
