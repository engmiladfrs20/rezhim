export interface UserRecord {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  password_salt: string;
  password_algorithm: string;
  password_iterations: number;
  display_name: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  locale: 'fa' | 'en';
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface LoginAttemptRecord {
  ip_hash: string | null;
  email_hash: string | null;
  window_start: string;
  attempts: number;
}

export interface FoodCategoryRecord {
  id: string;
  slug: string;
  parent_id: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface FoodCategoryTranslationRecord {
  id: string;
  category_id: string;
  locale: 'fa' | 'en';
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodSourceRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  url: string | null;
  license: string | null;
  acquisition_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutrientDefinitionRecord {
  id: string;
  code: string;
  name_fa: string;
  name_en: string;
  unit: 'kcal' | 'g' | 'mg' | 'mcg' | 'IU';
  sort_order: number;
  is_essential: number | boolean;
  created_at: string;
  updated_at: string;
}

export interface FoodRecord {
  id: string;
  category_id: string | null;
  food_type: 'generic' | 'branded';
  brand_name: string | null;
  barcode: string | null;
  status: 'draft' | 'active' | 'archived';
  source_id: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodTranslationRecord {
  id: string;
  food_id: string;
  locale: 'fa' | 'en';
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodAliasRecord {
  id: string;
  food_id: string;
  locale: 'fa' | 'en';
  alias: string;
  created_at: string;
}

export interface FoodNutrientRecord {
  id: string;
  food_id: string;
  nutrient_id: string;
  amount_per_100g: number;
  source_id?: string | null;
  external_id?: string | null;
  source_url?: string | null;
  citation?: string | null;
  dataset_version?: string | null;
  method?: string | null;
  retrieved_at?: string | null;
  license?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodServingRecord {
  id: string;
  food_id: string;
  name_fa: string;
  name_en: string;
  weight_g: number;
  household_unit: string | null;
  source_id?: string | null;
  external_id?: string | null;
  source_url?: string | null;
  citation?: string | null;
  dataset_version?: string | null;
  method?: string | null;
  retrieved_at?: string | null;
  license?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodImportLogRecord {
  id: string;
  source_id: string;
  dataset_name: string;
  file_checksum: string;
  total_records: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  skipped_count: number;
  status: 'success' | 'failed' | 'dry_run';
  error_summary: string | null;
  executed_by: string;
  created_at: string;
}
