import { describe, it, expect } from 'vitest';
import {
  CloudflareEnvSchema,
  PublicClientEnvSchema,
  ObjectKeySchema,
  SignedUploadUrlRequestSchema,
  SignedDownloadUrlRequestSchema,
  BackblazeB2ConfigSchema,
  HealthCheckResponseSchema,
  createFoodSchema,
  foodServingInputSchema,
  foodNutrientInputSchema,
  createFoodCategorySchema,
} from '../src';

describe('Zod Schemas Package', () => {
  it('validates CloudflareEnvSchema defaults and overrides', () => {
    const defaultEnv = CloudflareEnvSchema.parse({});
    expect(defaultEnv.APP_ENV).toBe('development');
    expect(defaultEnv.SERVICE_NAME).toBe('nutriai-api');
    expect(defaultEnv.APP_VERSION).toBe('1.0.0');

    const customEnv = CloudflareEnvSchema.parse({
      APP_ENV: 'production',
      SERVICE_NAME: 'custom-api',
      ALLOWED_ORIGINS: 'https://nutriai.persia',
      B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
      B2_REGION: 'us-west-004',
      B2_BUCKET_NAME: 'nutriai-prod',
      B2_KEY_ID: 'key123',
      B2_APPLICATION_KEY: 'secret123',
    });
    expect(customEnv.APP_ENV).toBe('production');
    expect(customEnv.ALLOWED_ORIGINS).toBe('https://nutriai.persia');
  });

  it('validates PublicClientEnvSchema', () => {
    const defaultEnv = PublicClientEnvSchema.parse({});
    expect(defaultEnv.VITE_APP_ENV).toBe('development');
    expect(defaultEnv.VITE_DEFAULT_LOCALE).toBe('fa');

    const customEnv = PublicClientEnvSchema.parse({
      VITE_APP_ENV: 'staging',
      VITE_API_BASE_URL: 'https://api.nutriai.persia',
      VITE_DEFAULT_LOCALE: 'en',
    });
    expect(customEnv.VITE_DEFAULT_LOCALE).toBe('en');
  });

  it('validates ObjectKeySchema against path traversal and illegal characters', () => {
    expect(ObjectKeySchema.safeParse('valid/path/image.jpg').success).toBe(true);
    expect(ObjectKeySchema.safeParse('/leading-slash.jpg').success).toBe(false);
    expect(ObjectKeySchema.safeParse('../traversal.jpg').success).toBe(false);
    expect(ObjectKeySchema.safeParse('').success).toBe(false);
  });

  it('validates SignedUploadUrlRequestSchema and SignedDownloadUrlRequestSchema', () => {
    const validUpload = SignedUploadUrlRequestSchema.safeParse({
      key: 'uploads/pic.png',
      contentType: 'image/png',
      expiresInSeconds: 300,
    });
    expect(validUpload.success).toBe(true);

    const invalidMime = SignedUploadUrlRequestSchema.safeParse({
      key: 'uploads/pic.png',
      contentType: 'invalid-mime',
    });
    expect(invalidMime.success).toBe(false);

    const validDownload = SignedDownloadUrlRequestSchema.safeParse({
      key: 'uploads/pic.png',
      expiresInSeconds: 600,
    });
    expect(validDownload.success).toBe(true);
  });

  it('validates BackblazeB2ConfigSchema', () => {
    const valid = BackblazeB2ConfigSchema.safeParse({
      endpoint: 'https://s3.us-west-004.backblazeb2.com',
      region: 'us-west-004',
      bucketName: 'nutriai-bucket-dev',
      keyId: 'k123',
      applicationKey: 'appKey123',
    });
    expect(valid.success).toBe(true);

    const invalidBucket = BackblazeB2ConfigSchema.safeParse({
      endpoint: 'https://s3.us-west-004.backblazeb2.com',
      region: 'us-west-004',
      bucketName: 'INVALID_CAPS_BUCKET',
      keyId: 'k123',
      applicationKey: 'appKey123',
    });
    expect(invalidBucket.success).toBe(false);
  });

  it('validates HealthCheckResponseSchema', () => {
    const valid = HealthCheckResponseSchema.safeParse({
      status: 'ok',
      service: 'nutriai-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
    expect(valid.success).toBe(true);
  });

  it('validates createFoodSchema and updateFoodSchema rules', () => {
    // 1. Valid Food Payload
    const validFood = createFoodSchema.safeParse({
      translations: [{ locale: 'fa', name: 'نان جو' }],
      food_type: 'generic',
      status: 'active',
      nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: 220 }],
      servings: [{ name_fa: 'یک برش', name_en: '1 Slice', weight_g: 35 }],
    });
    expect(validFood.success).toBe(true);

    // 2. Missing Translations
    const noTrans = createFoodSchema.safeParse({
      translations: [],
    });
    expect(noTrans.success).toBe(false);

    // 3. Serving with zero / negative weight
    const badServing = foodServingInputSchema.safeParse({
      name_fa: 'یک واحد',
      name_en: '1 Unit',
      weight_g: 0,
    });
    expect(badServing.success).toBe(false);

    // 4. Nutrient with negative amount
    const negNutrient = foodNutrientInputSchema.safeParse({
      nutrient_id: 'nut_energy',
      amount_per_100g: -10,
    });
    expect(negNutrient.success).toBe(false);

    // 5. Category Slug Validation
    const validCat = createFoodCategorySchema.safeParse({
      slug: 'dairy-products',
      translations: [{ locale: 'fa', name: 'لبنیات' }],
    });
    expect(validCat.success).toBe(true);

    const invalidCatSlug = createFoodCategorySchema.safeParse({
      slug: 'Dairy Products With Spaces!',
      translations: [{ locale: 'fa', name: 'لبنیات' }],
    });
    expect(invalidCatSlug.success).toBe(false);

    // 6. Barcode normalization and validation
    const persianBarcodeFood = createFoodSchema.safeParse({
      barcode: '۶۲۶-۰۰۰۰-۱۲۳۴',
      translations: [{ locale: 'fa', name: 'شیر کم‌چرب' }],
    });
    expect(persianBarcodeFood.success).toBe(true);
    if (persianBarcodeFood.success) {
      expect(persianBarcodeFood.data.barcode).toBe('62600001234');
    }

    const invalidBarcodeFood = createFoodSchema.safeParse({
      barcode: '12345', // less than 8 digits
      translations: [{ locale: 'fa', name: 'شیر' }],
    });
    expect(invalidBarcodeFood.success).toBe(false);

    // 7. Duplicate checks
    const dupNutrients = createFoodSchema.safeParse({
      translations: [{ locale: 'fa', name: 'ماست' }],
      nutrients: [
        { nutrient_id: 'nut_energy', amount_per_100g: 100 },
        { nutrient_id: 'nut_energy', amount_per_100g: 120 },
      ],
    });
    expect(dupNutrients.success).toBe(false);

    // 8. Branded food validation
    const invalidBranded = createFoodSchema.safeParse({
      food_type: 'branded',
      brand_name: '',
      translations: [{ locale: 'fa', name: 'شیر' }],
    });
    expect(invalidBranded.success).toBe(false);

    // 9. External ID without source ID
    const invalidExternal = createFoodSchema.safeParse({
      external_id: 'usda_123',
      translations: [{ locale: 'fa', name: 'سیب' }],
    });
    expect(invalidExternal.success).toBe(false);
  });

  it('validates foodSourceManifestSchema, foodDatasetFileSchema and import schemas', async () => {
    const {
      foodSourceManifestSchema,
      foodDatasetItemSchema,
      foodDatasetFileSchema,
      importResultSchema,
    } = await import('../src');

    // 1. Valid Manifest
    const validManifest = foodSourceManifestSchema.safeParse({
      id: 'src_open_iranian_foods',
      name: 'NutriAI Open Iranian Food Catalog Baseline',
      code: 'open_iranian_foods',
      publisher: 'NutriAI Persia Project',
      url: 'https://github.com/engmiladfrs20/rezhim',
      version: '1.0.0',
      acquisitionDate: '2026-08-30T00:00:00Z',
      license: 'CC0-1.0',
      redistributionAllowed: true,
      sha256Checksum: 'a'.repeat(64),
      language: 'fa, en',
      description: 'Open baseline dataset for Iranian traditional food catalog',
    });
    expect(validManifest.success).toBe(true);

    // Invalid Manifest - bad sha256
    const badChecksumManifest = foodSourceManifestSchema.safeParse({
      id: 'src_open_iranian_foods',
      name: 'Test',
      code: 'test',
      publisher: 'Test',
      url: 'https://example.com',
      version: '1.0.0',
      acquisitionDate: '2026-08-30T00:00:00Z',
      license: 'CC0',
      redistributionAllowed: true,
      sha256Checksum: 'short_checksum',
      language: 'fa',
    });
    expect(badChecksumManifest.success).toBe(false);

    // 2. Valid Dataset Item
    const validItem = foodDatasetItemSchema.safeParse({
      source_id: 'src_open_iranian_foods',
      external_id: 'item_sangak',
      food_type: 'generic',
      status: 'active',
      translations: [
        { locale: 'fa', name: 'نان سنگک' },
        { locale: 'en', name: 'Sangak Bread' },
      ],
      aliases: [{ locale: 'fa', alias: 'سنگک سنتی' }],
      nutrients: [{ nutrient_id: 'nut_energy', amount_per_100g: 259 }],
      servings: [{ name_fa: '۱ کف دست', name_en: '1 Handful', weight_g: 30 }],
    });
    expect(validItem.success).toBe(true);

    // 3. Valid Full Dataset File
    if (validManifest.success && validItem.success) {
      const fullFile = foodDatasetFileSchema.safeParse({
        manifest: validManifest.data,
        foods: [validItem.data],
      });
      expect(fullFile.success).toBe(true);
    }

    // 4. Valid Import Result
    const validImportRes = importResultSchema.safeParse({
      sourceId: 'src_open_iranian_foods',
      datasetName: 'foods.json',
      mode: 'import',
      fileChecksum: 'a'.repeat(64),
      totalRecords: 10,
      insertedCount: 10,
      updatedCount: 0,
      unchangedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      status: 'success',
      errors: [],
      executionTimeMs: 120,
    });
    expect(validImportRes.success).toBe(true);
  });
});
