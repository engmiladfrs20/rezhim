import type {
  FoodDetail,
  FoodCategorySummary,
  FoodCategoryDetail,
  FoodCategoryTranslation,
  FoodNutrientValue,
  FoodServing,
  FoodTranslation,
  FoodAlias,
  FoodSource,
  SupportedLocale,
} from '@nutriai/types';
import type {
  FoodCategoryRecord,
  FoodCategoryTranslationRecord,
  FoodSourceRecord,
} from '../db/models';
import type { FullFoodDetailRecord } from '../db/food.repository';
import type { CategoryWithTranslations } from '../db/food-category.repository';

export class FoodMapper {
  static toCategorySummary(
    record: FoodCategoryRecord,
    translations: FoodCategoryTranslationRecord[],
    locale: SupportedLocale,
  ): FoodCategorySummary {
    const reqTrans = translations.find((t) => t.locale === locale);
    const faTrans = translations.find((t) => t.locale === 'fa');
    const fallbackTrans = translations[0];

    const chosen = reqTrans || faTrans || fallbackTrans;
    const resolvedLocale = (chosen?.locale || 'fa') as SupportedLocale;

    return {
      id: record.id,
      slug: record.slug,
      parentId: record.parent_id,
      status: record.status,
      name: chosen ? chosen.name : record.slug,
      description: chosen ? chosen.description : null,
      locale: resolvedLocale,
      resolvedLocale,
      requestedLocale: locale,
    };
  }

  static toCategoryDetail(
    categoryWithTrans: CategoryWithTranslations,
    locale: SupportedLocale,
  ): FoodCategoryDetail {
    const summary = this.toCategorySummary(
      categoryWithTrans.category,
      categoryWithTrans.translations,
      locale,
    );

    const transList: FoodCategoryTranslation[] = categoryWithTrans.translations.map((t) => ({
      id: t.id,
      categoryId: t.category_id,
      locale: t.locale as SupportedLocale,
      name: t.name,
      description: t.description,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return {
      ...summary,
      translations: transList,
      createdAt: categoryWithTrans.category.created_at,
      updatedAt: categoryWithTrans.category.updated_at,
    };
  }

  static toFoodSource(record: FoodSourceRecord): FoodSource {
    return {
      id: record.id,
      name: record.name,
      code: record.code,
      description: record.description,
      url: record.url,
      license: record.license,
      acquisitionDate: record.acquisition_date,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  static toFoodDetail(full: FullFoodDetailRecord, locale: SupportedLocale): FoodDetail {
    const reqTrans = full.translations.find((t) => t.locale === locale);
    const faTrans = full.translations.find((t) => t.locale === 'fa');
    const fallbackTrans = full.translations[0];

    const chosen = reqTrans || faTrans || fallbackTrans;
    const resolvedLocale = (chosen?.locale || 'fa') as SupportedLocale;
    const name = chosen ? chosen.name : 'Unnamed';
    const description = chosen ? chosen.description : null;

    let categorySummary: FoodCategorySummary | null = null;
    if (full.category) {
      categorySummary = this.toCategorySummary(
        full.category.category,
        full.category.translations,
        locale,
      );
    }

    const translations: FoodTranslation[] = full.translations.map((t) => ({
      id: t.id,
      foodId: t.food_id,
      locale: t.locale as SupportedLocale,
      name: t.name,
      description: t.description,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    const aliases: FoodAlias[] = full.aliases.map((a) => ({
      id: a.id,
      foodId: a.food_id,
      locale: a.locale as SupportedLocale,
      alias: a.alias,
      createdAt: a.created_at,
    }));

    const nutrients: FoodNutrientValue[] = full.nutrients.map((n) => ({
      nutrientId: n.nutrient_id,
      code: n.code,
      name: locale === 'en' ? n.name_en : n.name_fa,
      unit: n.unit,
      amountPer100g: Number(n.amount_per_100g),
    }));

    const servings: FoodServing[] = full.servings.map((s) => ({
      id: s.id,
      foodId: s.food_id,
      nameFa: s.name_fa,
      nameEn: s.name_en,
      weightG: Number(s.weight_g),
      householdUnit: s.household_unit,
    }));

    return {
      id: full.food.id,
      name,
      description,
      locale: resolvedLocale,
      resolvedLocale,
      requestedLocale: locale,
      foodType: full.food.food_type,
      brandName: full.food.brand_name,
      barcode: full.food.barcode,
      status: full.food.status,
      categoryId: full.food.category_id,
      category: categorySummary,
      sourceId: full.food.source_id,
      source: full.source ? this.toFoodSource(full.source) : null,
      externalId: full.food.external_id,
      translations,
      aliases,
      nutrients,
      servings,
      createdAt: full.food.created_at,
      updatedAt: full.food.updated_at,
    };
  }
}
