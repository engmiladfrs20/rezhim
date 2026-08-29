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
  });
});
