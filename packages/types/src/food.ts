import type { SupportedLocale } from './localization';

export type FoodStatus = 'draft' | 'active' | 'archived';
export type FoodType = 'generic' | 'branded';
export type NutrientUnit = 'kcal' | 'g' | 'mg' | 'mcg' | 'IU';

export interface FoodCategoryTranslation {
  id: string;
  categoryId: string;
  locale: SupportedLocale;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodCategorySummary {
  id: string;
  slug: string;
  parentId: string | null;
  status: 'active' | 'archived';
  name: string;
  description: string | null;
  locale: SupportedLocale;
  resolvedLocale: SupportedLocale;
  requestedLocale?: SupportedLocale;
}

export interface FoodCategoryDetail extends FoodCategorySummary {
  translations: FoodCategoryTranslation[];
  createdAt: string;
  updatedAt: string;
}

export interface FoodSource {
  id: string;
  name: string;
  code: string;
  description: string | null;
  url: string | null;
  license: string | null;
  acquisitionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NutrientDefinition {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  unit: NutrientUnit;
  sortOrder: number;
  isEssential: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FoodNutrientValue {
  nutrientId: string;
  code: string;
  name: string;
  unit: NutrientUnit;
  amountPer100g: number;
}

export interface FoodServing {
  id: string;
  foodId: string;
  nameFa: string;
  nameEn: string;
  weightG: number;
  householdUnit: string | null;
}

export interface FoodTranslation {
  id: string;
  foodId: string;
  locale: SupportedLocale;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodAlias {
  id: string;
  foodId: string;
  locale: SupportedLocale;
  alias: string;
  createdAt: string;
}

export interface FoodSummary {
  id: string;
  name: string;
  description: string | null;
  locale: SupportedLocale;
  resolvedLocale: SupportedLocale;
  requestedLocale?: SupportedLocale;
  foodType: FoodType;
  brandName: string | null;
  barcode: string | null;
  status: FoodStatus;
  categoryId: string | null;
  categoryName: string | null;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodDetail {
  id: string;
  name: string;
  description: string | null;
  locale: SupportedLocale;
  resolvedLocale: SupportedLocale;
  requestedLocale?: SupportedLocale;
  foodType: FoodType;
  brandName: string | null;
  barcode: string | null;
  status: FoodStatus;
  categoryId: string | null;
  category: FoodCategorySummary | null;
  sourceId: string | null;
  source: FoodSource | null;
  externalId: string | null;
  translations: FoodTranslation[];
  aliases: FoodAlias[];
  nutrients: FoodNutrientValue[];
  servings: FoodServing[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}
