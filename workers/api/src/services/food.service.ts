import type { D1Database } from '@cloudflare/workers-types';
import { FoodRepository } from '../db/food.repository';
import { FoodCategoryRepository } from '../db/food-category.repository';
import { NutrientRepository } from '../db/nutrient.repository';
import { FoodSourceRepository } from '../db/food-source.repository';
import { FoodMapper } from './food.mapper';
import { FoodNotFoundError, FoodConflictError, FoodValidationError } from '../db/errors';
import type {
  FoodSummary,
  FoodDetail,
  FoodCategorySummary,
  FoodCategoryDetail,
  NutrientDefinition,
  FoodSource,
  PaginatedResult,
  SupportedLocale,
  FoodType,
} from '@nutriai/types';
import type {
  CreateFoodDto,
  UpdateFoodDto,
  CreateFoodCategoryDto,
  FoodListQueryDto,
  AdminFoodListQueryDto,
  FoodNutrientInputDto,
  FoodServingInputDto,
} from '@nutriai/schemas';
import type {
  FoodRecord,
  FoodTranslationRecord,
  FoodAliasRecord,
  FoodNutrientRecord,
  FoodServingRecord,
  FoodCategoryRecord,
  FoodCategoryTranslationRecord,
} from '../db/models';

export interface FoodInvariantsInput {
  food_type: FoodType;
  brand_name?: string | null | undefined;
  source_id?: string | null | undefined;
  external_id?: string | null | undefined;
}

export function validateFoodInvariants(input: FoodInvariantsInput): void {
  if (input.food_type === 'branded') {
    if (!input.brand_name || input.brand_name.trim().length === 0) {
      throw new FoodValidationError('Branded food requires a valid brand_name');
    }
  }

  if (input.external_id && input.external_id.trim().length > 0) {
    if (!input.source_id || input.source_id.trim().length === 0) {
      throw new FoodValidationError('external_id requires source_id');
    }
  }
}

type ProvenanceRecord = {
  source_id?: string | null | undefined;
  external_id?: string | null | undefined;
  source_url?: string | null | undefined;
  citation?: string | null | undefined;
  dataset_version?: string | null | undefined;
  method?: string | null | undefined;
  retrieved_at?: string | null | undefined;
  license?: string | null | undefined;
};

const REQUIRED_PROVENANCE_FIELDS = [
  'source_id',
  'external_id',
  'source_url',
  'citation',
  'dataset_version',
  'method',
  'retrieved_at',
  'license',
] as const;

function assertCompleteProvenance(record: ProvenanceRecord, label: string): void {
  for (const field of REQUIRED_PROVENANCE_FIELDS) {
    const value = record[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      throw new FoodValidationError(`Active food ${label} must have non-empty ${field}`);
    }
  }
}

function validateActiveFoodPublication(
  nutrients: Array<ProvenanceRecord & { nutrient_id: string }>,
  servings: Array<ProvenanceRecord & { name_en: string }>,
): void {
  const nutrientIds = new Set(nutrients.map((nutrient) => nutrient.nutrient_id));
  for (const requiredMacro of ['nut_energy', 'nut_protein', 'nut_carbohydrate', 'nut_fat_total']) {
    if (!nutrientIds.has(requiredMacro)) {
      throw new FoodValidationError(`Active food must have macro nutrient '${requiredMacro}'`);
    }
  }

  for (const nutrient of nutrients) {
    assertCompleteProvenance(nutrient, `nutrient '${nutrient.nutrient_id}'`);
  }
  for (const serving of servings) {
    assertCompleteProvenance(serving, `serving '${serving.name_en}'`);
  }
}

export class FoodService {
  private readonly foodRepo: FoodRepository;
  private readonly catRepo: FoodCategoryRepository;
  private readonly nutrientRepo: NutrientRepository;
  private readonly sourceRepo: FoodSourceRepository;

  constructor(db: D1Database) {
    this.foodRepo = new FoodRepository(db);
    this.catRepo = new FoodCategoryRepository(db);
    this.nutrientRepo = new NutrientRepository(db);
    this.sourceRepo = new FoodSourceRepository(db);
  }

  private async validateProvenanceSources(
    nutrients: FoodNutrientInputDto[] | undefined,
    servings: FoodServingInputDto[] | undefined,
  ): Promise<void> {
    const sourceIds = new Set<string>();
    for (const item of [...(nutrients ?? []), ...(servings ?? [])]) {
      if (item.source_id) sourceIds.add(item.source_id);
    }

    for (const sourceId of sourceIds) {
      if (!(await this.sourceRepo.findById(sourceId))) {
        throw new FoodValidationError(`Provenance source with ID ${sourceId} not found`);
      }
    }
  }

  async getPublicFoodList(query: FoodListQueryDto): Promise<PaginatedResult<FoodSummary>> {
    return await this.foodRepo.listPublic({
      locale: query.locale,
      categoryId: query.category_id,
      search: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async getPublicFoodDetail(id: string, locale: SupportedLocale): Promise<FoodDetail> {
    const full = await this.foodRepo.findFullDetailById(id);
    if (!full || full.food.status !== 'active') {
      throw new FoodNotFoundError();
    }
    return FoodMapper.toFoodDetail(full, locale);
  }

  async getCategories(locale: SupportedLocale): Promise<FoodCategorySummary[]> {
    const categoriesWithTrans = await this.catRepo.listAll('active');
    return categoriesWithTrans.map((c) =>
      FoodMapper.toCategorySummary(c.category, c.translations, locale),
    );
  }

  async getNutrients(): Promise<NutrientDefinition[]> {
    const records = await this.nutrientRepo.listAll();
    return records.map((r) => ({
      id: r.id,
      code: r.code,
      nameFa: r.name_fa,
      nameEn: r.name_en,
      unit: r.unit,
      sortOrder: r.sort_order,
      isEssential: Boolean(r.is_essential),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getSources(): Promise<FoodSource[]> {
    const records = await this.sourceRepo.listAll();
    return records.map((r) => FoodMapper.toFoodSource(r));
  }

  async getAdminFoodList(query: AdminFoodListQueryDto): Promise<PaginatedResult<FoodSummary>> {
    return await this.foodRepo.listAdmin({
      status: query.status,
      categoryId: query.category_id,
      locale: query.locale,
      search: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async getAdminFoodDetail(id: string, locale: SupportedLocale): Promise<FoodDetail> {
    const full = await this.foodRepo.findFullDetailById(id);
    if (!full) {
      throw new FoodNotFoundError();
    }
    return FoodMapper.toFoodDetail(full, locale);
  }

  async createFood(dto: CreateFoodDto): Promise<FoodDetail> {
    const now = new Date().toISOString();

    // 0. Enforce food model invariants
    validateFoodInvariants({
      food_type: dto.food_type,
      brand_name: dto.brand_name,
      source_id: dto.source_id,
      external_id: dto.external_id,
    });

    // 1. Validate Category if provided
    if (dto.category_id) {
      const cat = await this.catRepo.findById(dto.category_id);
      if (!cat) {
        throw new FoodValidationError(`Category with ID ${dto.category_id} not found`);
      }
    }

    // 2. Validate Source if provided
    if (dto.source_id) {
      const source = await this.sourceRepo.findById(dto.source_id);
      if (!source) {
        throw new FoodValidationError(`Food source with ID ${dto.source_id} not found`);
      }
    }

    // 3. Validate unique barcode
    if (dto.barcode) {
      const existingBarcode = await this.foodRepo.findByBarcode(dto.barcode);
      if (existingBarcode) {
        throw new FoodConflictError(`A food with barcode "${dto.barcode}" already exists`);
      }
    }

    // 4. Validate unique source + external ID
    if (dto.source_id && dto.external_id) {
      const existingExternal = await this.foodRepo.findBySourceAndExternalId(
        dto.source_id,
        dto.external_id,
      );
      if (existingExternal) {
        throw new FoodConflictError(
          `A food with external ID "${dto.external_id}" from source "${dto.source_id}" already exists`,
        );
      }
    }

    // 5. Validate nutrient IDs
    if (dto.nutrients && dto.nutrients.length > 0) {
      const allNutrients = await this.nutrientRepo.listAll();
      const validNutrientIds = new Set(allNutrients.map((n) => n.id));
      for (const n of dto.nutrients) {
        if (!validNutrientIds.has(n.nutrient_id)) {
          throw new FoodValidationError(`Invalid nutrient ID: ${n.nutrient_id}`);
        }
      }
    }

    await this.validateProvenanceSources(dto.nutrients, dto.servings);

    const foodId = `food_${crypto.randomUUID()}`;

    const foodRecord: FoodRecord = {
      id: foodId,
      category_id: dto.category_id ?? null,
      food_type: dto.food_type,
      brand_name: dto.brand_name ?? null,
      barcode: dto.barcode ?? null,
      status: dto.status,
      source_id: dto.source_id ?? null,
      external_id: dto.external_id ?? null,
      created_at: now,
      updated_at: now,
    };

    const translationRecords: FoodTranslationRecord[] = dto.translations.map((t) => ({
      id: `ft_${crypto.randomUUID()}`,
      food_id: foodId,
      locale: t.locale,
      name: t.name,
      description: t.description ?? null,
      created_at: now,
      updated_at: now,
    }));

    const aliasRecords: FoodAliasRecord[] = (dto.aliases || []).map((a) => ({
      id: `fa_${crypto.randomUUID()}`,
      food_id: foodId,
      locale: a.locale,
      alias: a.alias,
      created_at: now,
    }));

    const nutrientRecords: FoodNutrientRecord[] = (dto.nutrients || []).map((n) => ({
      id: `fn_${crypto.randomUUID()}`,
      food_id: foodId,
      nutrient_id: n.nutrient_id,
      amount_per_100g: n.amount_per_100g,
      source_id: n.source_id ?? null,
      external_id: n.external_id ?? null,
      source_url: n.source_url ?? null,
      citation: n.citation ?? null,
      dataset_version: n.dataset_version ?? null,
      method: n.method ?? null,
      retrieved_at: n.retrieved_at ?? null,
      license: n.license ?? null,
      created_at: now,
      updated_at: now,
    }));

    const servingRecords: FoodServingRecord[] = (dto.servings || []).map((s) => ({
      id: `fs_${crypto.randomUUID()}`,
      food_id: foodId,
      name_fa: s.name_fa,
      name_en: s.name_en,
      weight_g: s.weight_g,
      household_unit: s.household_unit ?? null,
      source_id: s.source_id ?? null,
      external_id: s.external_id ?? null,
      source_url: s.source_url ?? null,
      citation: s.citation ?? null,
      dataset_version: s.dataset_version ?? null,
      method: s.method ?? null,
      retrieved_at: s.retrieved_at ?? null,
      license: s.license ?? null,
      created_at: now,
      updated_at: now,
    }));

    await this.foodRepo.createAtomic(
      foodRecord,
      translationRecords,
      aliasRecords,
      nutrientRecords,
      servingRecords,
    );

    return await this.getAdminFoodDetail(foodId, 'fa');
  }

  async updateFood(id: string, dto: UpdateFoodDto): Promise<FoodDetail> {
    const existing = await this.foodRepo.findById(id);
    if (!existing) {
      throw new FoodNotFoundError();
    }

    const now = new Date().toISOString();

    // 1. Resolve merged core fields
    const newFoodType = dto.food_type ?? existing.food_type;
    let newBrandName: string | null;
    if (dto.brand_name !== undefined) {
      newBrandName = dto.brand_name;
    } else if (dto.food_type === 'generic' && existing.food_type === 'branded') {
      // Switching from branded to generic clears brand_name when not explicitly passed
      newBrandName = null;
    } else {
      newBrandName = existing.brand_name;
    }

    const newSourceId = dto.source_id !== undefined ? dto.source_id : existing.source_id;
    const newExternalId = dto.external_id !== undefined ? dto.external_id : existing.external_id;

    // 2. Enforce model invariants on final merged state
    validateFoodInvariants({
      food_type: newFoodType,
      brand_name: newBrandName,
      source_id: newSourceId,
      external_id: newExternalId,
    });

    // 3. Validate Category
    const categoryId = dto.category_id !== undefined ? dto.category_id : existing.category_id;
    if (categoryId) {
      const cat = await this.catRepo.findById(categoryId);
      if (!cat) {
        throw new FoodValidationError(`Category with ID ${categoryId} not found`);
      }
    }

    // 4. Validate Source if present
    if (newSourceId) {
      const source = await this.sourceRepo.findById(newSourceId);
      if (!source) {
        throw new FoodValidationError(`Food source with ID ${newSourceId} not found`);
      }
    }

    // 5. Validate Barcode conflict
    const barcode = dto.barcode !== undefined ? dto.barcode : existing.barcode;
    if (barcode && barcode !== existing.barcode) {
      const existingBarcode = await this.foodRepo.findByBarcode(barcode);
      if (existingBarcode && existingBarcode.id !== id) {
        throw new FoodConflictError(`A food with barcode "${barcode}" already exists`);
      }
    }

    // 6. Validate Source + External ID conflict
    if (
      newSourceId &&
      newExternalId &&
      (newSourceId !== existing.source_id || newExternalId !== existing.external_id)
    ) {
      const existingExternal = await this.foodRepo.findBySourceAndExternalId(
        newSourceId,
        newExternalId,
      );
      if (existingExternal && existingExternal.id !== id) {
        throw new FoodConflictError(
          `A food with external ID "${newExternalId}" from source "${newSourceId}" already exists`,
        );
      }
    }

    // 7. Validate nutrient IDs if updated
    if (dto.nutrients && dto.nutrients.length > 0) {
      const allNutrients = await this.nutrientRepo.listAll();
      const validNutrientIds = new Set(allNutrients.map((n) => n.id));
      for (const n of dto.nutrients) {
        if (!validNutrientIds.has(n.nutrient_id)) {
          throw new FoodValidationError(`Invalid nutrient ID: ${n.nutrient_id}`);
        }
      }
    }

    await this.validateProvenanceSources(dto.nutrients, dto.servings);

    // 8. Enforce active food requirements on merged state
    const resultingStatus = dto.status ?? existing.status;
    if (resultingStatus === 'active') {
      const full = await this.foodRepo.findFullDetailById(id);
      if (!full) throw new FoodNotFoundError();

      let finalNutrients: Array<ProvenanceRecord & { nutrient_id: string }>;
      if (dto.nutrients) {
        finalNutrients = dto.nutrients;
      } else {
        finalNutrients = full.nutrients;
      }

      let finalServings: Array<ProvenanceRecord & { name_en: string }>;
      if (dto.servings) {
        finalServings = dto.servings;
      } else {
        finalServings = full.servings;
      }

      validateActiveFoodPublication(finalNutrients, finalServings);
      await this.validateProvenanceSources(
        finalNutrients as FoodNutrientInputDto[],
        finalServings as FoodServingInputDto[],
      );
    }

    const updatedRecord: FoodRecord = {
      id,
      category_id: categoryId ?? null,
      food_type: newFoodType,
      brand_name: newBrandName ?? null,
      barcode: barcode ?? null,
      status: resultingStatus,
      source_id: newSourceId ?? null,
      external_id: newExternalId ?? null,
      created_at: existing.created_at,
      updated_at: now,
    };

    let translationRecords: FoodTranslationRecord[] | undefined;
    if (dto.translations) {
      translationRecords = dto.translations.map((t) => ({
        id: `ft_${crypto.randomUUID()}`,
        food_id: id,
        locale: t.locale,
        name: t.name,
        description: t.description ?? null,
        created_at: now,
        updated_at: now,
      }));
    }

    let aliasRecords: FoodAliasRecord[] | undefined;
    if (dto.aliases) {
      aliasRecords = dto.aliases.map((a) => ({
        id: `fa_${crypto.randomUUID()}`,
        food_id: id,
        locale: a.locale,
        alias: a.alias,
        created_at: now,
      }));
    }

    let nutrientRecords: FoodNutrientRecord[] | undefined;
    if (dto.nutrients) {
      nutrientRecords = dto.nutrients.map((n) => ({
        id: `fn_${crypto.randomUUID()}`,
        food_id: id,
        nutrient_id: n.nutrient_id,
        amount_per_100g: n.amount_per_100g,
        source_id: n.source_id ?? null,
        external_id: n.external_id ?? null,
        source_url: n.source_url ?? null,
        citation: n.citation ?? null,
        dataset_version: n.dataset_version ?? null,
        method: n.method ?? null,
        retrieved_at: n.retrieved_at ?? null,
        license: n.license ?? null,
        created_at: now,
        updated_at: now,
      }));
    }

    let servingRecords: FoodServingRecord[] | undefined;
    if (dto.servings) {
      servingRecords = dto.servings.map((s) => ({
        id: `fs_${crypto.randomUUID()}`,
        food_id: id,
        name_fa: s.name_fa,
        name_en: s.name_en,
        weight_g: s.weight_g,
        household_unit: s.household_unit ?? null,
        source_id: s.source_id ?? null,
        external_id: s.external_id ?? null,
        source_url: s.source_url ?? null,
        citation: s.citation ?? null,
        dataset_version: s.dataset_version ?? null,
        method: s.method ?? null,
        retrieved_at: s.retrieved_at ?? null,
        license: s.license ?? null,
        created_at: now,
        updated_at: now,
      }));
    }

    await this.foodRepo.updateAtomic(
      updatedRecord,
      translationRecords,
      aliasRecords,
      nutrientRecords,
      servingRecords,
    );

    return await this.getAdminFoodDetail(id, 'fa');
  }

  async archiveFood(id: string): Promise<void> {
    const existing = await this.foodRepo.findById(id);
    if (!existing) {
      throw new FoodNotFoundError();
    }
    await this.foodRepo.archive(id);
  }

  async createCategory(dto: CreateFoodCategoryDto): Promise<FoodCategoryDetail> {
    if (dto.parent_id) {
      const parent = await this.catRepo.findById(dto.parent_id);
      if (!parent) {
        throw new FoodValidationError(`Parent category with ID ${dto.parent_id} not found`);
      }
    }

    const existingSlug = await this.catRepo.findBySlug(dto.slug);
    if (existingSlug) {
      throw new FoodConflictError(`A category with slug "${dto.slug}" already exists`);
    }

    const now = new Date().toISOString();
    const catId = `cat_${crypto.randomUUID()}`;

    const catRecord: FoodCategoryRecord = {
      id: catId,
      slug: dto.slug,
      parent_id: dto.parent_id ?? null,
      status: dto.status ?? 'active',
      created_at: now,
      updated_at: now,
    };

    const translationRecords: FoodCategoryTranslationRecord[] = dto.translations.map((t) => ({
      id: `cat_trans_${crypto.randomUUID()}`,
      category_id: catId,
      locale: t.locale,
      name: t.name,
      description: t.description ?? null,
      created_at: now,
      updated_at: now,
    }));

    await this.catRepo.createAtomic(catRecord, translationRecords);

    return FoodMapper.toCategoryDetail(
      { category: catRecord, translations: translationRecords },
      'fa',
    );
  }

  async listAdminCategories(): Promise<FoodCategoryDetail[]> {
    const categoriesWithTrans = await this.catRepo.listAll('all');
    return categoriesWithTrans.map((c) => FoodMapper.toCategoryDetail(c, 'fa'));
  }
}
