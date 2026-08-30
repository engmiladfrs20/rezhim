import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import type {
  FoodRecord,
  FoodTranslationRecord,
  FoodAliasRecord,
  FoodNutrientRecord,
  FoodServingRecord,
  FoodCategoryRecord,
  FoodCategoryTranslationRecord,
  FoodSourceRecord,
} from './models';
import {
  DatabaseError,
  FoodConflictError,
  FoodValidationError,
  InvalidCursorError,
} from './errors';
import type { FoodSummary, PaginatedResult, SupportedLocale } from '@nutriai/types';
import { decodeCursor, encodeCursor } from '../lib/cursor';

export interface FullFoodDetailRecord {
  food: FoodRecord;
  translations: FoodTranslationRecord[];
  aliases: FoodAliasRecord[];
  nutrients: Array<{
    nutrient_id: string;
    code: string;
    name_fa: string;
    name_en: string;
    unit: 'kcal' | 'g' | 'mg' | 'mcg' | 'IU';
    amount_per_100g: number;
    source_id?: string | null;
    external_id?: string | null;
    source_url?: string | null;
    citation?: string | null;
    dataset_version?: string | null;
    method?: string | null;
    retrieved_at?: string | null;
    license?: string | null;
  }>;
  servings: FoodServingRecord[];
  category: {
    category: FoodCategoryRecord;
    translations: FoodCategoryTranslationRecord[];
  } | null;
  source: FoodSourceRecord | null;
}

export class FoodRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<FoodRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM foods WHERE id = ?').bind(id);
      return await stmt.first<FoodRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food by ID: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findByBarcode(barcode: string): Promise<FoodRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM foods WHERE barcode = ?').bind(barcode);
      return await stmt.first<FoodRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food by barcode: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findBySourceAndExternalId(
    sourceId: string,
    externalId: string,
  ): Promise<FoodRecord | null> {
    try {
      const stmt = this.db
        .prepare('SELECT * FROM foods WHERE source_id = ? AND external_id = ?')
        .bind(sourceId, externalId);
      return await stmt.first<FoodRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food by source and external ID: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findFullDetailById(id: string): Promise<FullFoodDetailRecord | null> {
    try {
      const food = await this.findById(id);
      if (!food) {
        return null;
      }

      // Fetch translations, aliases, nutrients, servings, category, source concurrently
      const [transRes, aliasRes, nutRes, servRes, catRes, catTransRes, sourceRes] =
        await Promise.all([
          this.db
            .prepare('SELECT * FROM food_translations WHERE food_id = ? ORDER BY locale ASC')
            .bind(id)
            .all<FoodTranslationRecord>(),
          this.db
            .prepare('SELECT * FROM food_aliases WHERE food_id = ? ORDER BY alias ASC')
            .bind(id)
            .all<FoodAliasRecord>(),
          this.db
            .prepare(
              `SELECT fn.nutrient_id, nd.code, nd.name_fa, nd.name_en, nd.unit, fn.amount_per_100g,
                      fn.source_id, fn.external_id, fn.source_url, fn.citation, fn.dataset_version, fn.method, fn.retrieved_at, fn.license
             FROM food_nutrients fn
             JOIN nutrient_definitions nd ON fn.nutrient_id = nd.id
             WHERE fn.food_id = ?
             ORDER BY nd.sort_order ASC`,
            )
            .bind(id)
            .all<{
              nutrient_id: string;
              code: string;
              name_fa: string;
              name_en: string;
              unit: 'kcal' | 'g' | 'mg' | 'mcg' | 'IU';
              amount_per_100g: number;
              source_id?: string | null;
              external_id?: string | null;
              source_url?: string | null;
              citation?: string | null;
              dataset_version?: string | null;
              method?: string | null;
              retrieved_at?: string | null;
              license?: string | null;
            }>(),
          this.db
            .prepare('SELECT * FROM food_servings WHERE food_id = ? ORDER BY weight_g ASC')
            .bind(id)
            .all<FoodServingRecord>(),
          food.category_id
            ? this.db
                .prepare('SELECT * FROM food_categories WHERE id = ?')
                .bind(food.category_id)
                .first<FoodCategoryRecord>()
            : Promise.resolve(null),
          food.category_id
            ? this.db
                .prepare('SELECT * FROM food_category_translations WHERE category_id = ?')
                .bind(food.category_id)
                .all<FoodCategoryTranslationRecord>()
            : Promise.resolve(null),
          food.source_id
            ? this.db
                .prepare('SELECT * FROM food_sources WHERE id = ?')
                .bind(food.source_id)
                .first<FoodSourceRecord>()
            : Promise.resolve(null),
        ]);

      let categoryInfo: {
        category: FoodCategoryRecord;
        translations: FoodCategoryTranslationRecord[];
      } | null = null;
      if (catRes) {
        categoryInfo = {
          category: catRes,
          translations: catTransRes?.results || [],
        };
      }

      return {
        food,
        translations: transRes.results || [],
        aliases: aliasRes.results || [],
        nutrients: nutRes.results || [],
        servings: servRes.results || [],
        category: categoryInfo,
        source: sourceRes || null,
      };
    } catch (err) {
      throw new DatabaseError(
        `Failed to fetch full food detail: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listPublic(options: {
    locale: SupportedLocale;
    categoryId?: string | undefined;
    cursor?: string | undefined;
    limit: number;
  }): Promise<PaginatedResult<FoodSummary>> {
    const { locale, categoryId, cursor, limit } = options;

    let cursorCreatedAt: string | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      cursorCreatedAt = decoded.createdAt;
      cursorId = decoded.id;
    }

    try {
      let query = `
        SELECT 
          f.id,
          f.food_type,
          f.brand_name,
          f.barcode,
          f.status,
          f.category_id,
          f.created_at,
          f.updated_at,
          COALESCE(ft_req.locale, ft_fa.locale, ft_any.locale, ?) AS resolved_locale,
          COALESCE(ft_req.name, ft_fa.name, ft_any.name, 'Unnamed') AS name,
          COALESCE(ft_req.description, ft_fa.description, ft_any.description) AS description,
          COALESCE(ct_req.name, ct_fa.name, ct_any.name) AS category_name,
          fn_energy.amount_per_100g AS energy_kcal,
          fn_protein.amount_per_100g AS protein_g,
          fn_carbs.amount_per_100g AS carbs_g,
          fn_fat.amount_per_100g AS fat_g
        FROM foods f
        LEFT JOIN food_translations ft_req ON f.id = ft_req.food_id AND ft_req.locale = ?
        LEFT JOIN food_translations ft_fa ON f.id = ft_fa.food_id AND ft_fa.locale = 'fa'
        LEFT JOIN (
          SELECT food_id, locale, name, description
          FROM food_translations
          GROUP BY food_id
        ) ft_any ON f.id = ft_any.food_id
        LEFT JOIN food_category_translations ct_req ON f.category_id = ct_req.category_id AND ct_req.locale = ?
        LEFT JOIN food_category_translations ct_fa ON f.category_id = ct_fa.category_id AND ct_fa.locale = 'fa'
        LEFT JOIN (
          SELECT category_id, name
          FROM food_category_translations
          GROUP BY category_id
        ) ct_any ON f.category_id = ct_any.category_id
        LEFT JOIN food_nutrients fn_energy ON f.id = fn_energy.food_id AND fn_energy.nutrient_id = 'nut_energy'
        LEFT JOIN food_nutrients fn_protein ON f.id = fn_protein.food_id AND fn_protein.nutrient_id = 'nut_protein'
        LEFT JOIN food_nutrients fn_carbs ON f.id = fn_carbs.food_id AND fn_carbs.nutrient_id = 'nut_carbohydrate'
        LEFT JOIN food_nutrients fn_fat ON f.id = fn_fat.food_id AND fn_fat.nutrient_id = 'nut_fat_total'
        WHERE f.status = 'active'
      `;

      const params: (string | number)[] = [locale, locale, locale];

      if (categoryId) {
        query += ' AND f.category_id = ?';
        params.push(categoryId);
      }

      if (cursorCreatedAt && cursorId) {
        query += ' AND (f.created_at < ? OR (f.created_at = ? AND f.id < ?))';
        params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
      }

      query += ' ORDER BY f.created_at DESC, f.id DESC LIMIT ?';
      params.push(limit + 1);

      const stmt = this.db.prepare(query).bind(...params);
      const res = await stmt.all<{
        id: string;
        food_type: 'generic' | 'branded';
        brand_name: string | null;
        barcode: string | null;
        status: 'draft' | 'active' | 'archived';
        category_id: string | null;
        created_at: string;
        updated_at: string;
        resolved_locale: string;
        name: string;
        description: string | null;
        category_name: string | null;
        energy_kcal: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
      }>();

      const rows = res.results || [];
      const hasMore = rows.length > limit;
      const sliced = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && sliced.length > 0) {
        const last = sliced[sliced.length - 1]!;
        nextCursor = encodeCursor(last.created_at, last.id);
      }

      const items: FoodSummary[] = sliced.map((r) => {
        const resolvedLocale = (r.resolved_locale || locale) as SupportedLocale;
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          locale: resolvedLocale,
          resolvedLocale,
          requestedLocale: locale,
          foodType: r.food_type,
          brandName: r.brand_name,
          barcode: r.barcode,
          status: r.status,
          categoryId: r.category_id,
          categoryName: r.category_name,
          energyKcal: r.energy_kcal !== null ? Number(r.energy_kcal) : null,
          proteinG: r.protein_g !== null ? Number(r.protein_g) : null,
          carbsG: r.carbs_g !== null ? Number(r.carbs_g) : null,
          fatG: r.fat_g !== null ? Number(r.fat_g) : null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });

      return {
        items,
        nextCursor,
        hasMore,
      };
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        throw err;
      }
      throw new DatabaseError(
        `Failed to list public foods: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listAdmin(options: {
    status?: 'draft' | 'active' | 'archived' | 'all' | undefined;
    categoryId?: string | undefined;
    locale: SupportedLocale;
    cursor?: string | undefined;
    limit: number;
  }): Promise<PaginatedResult<FoodSummary>> {
    const { status, categoryId, locale, cursor, limit } = options;

    let cursorCreatedAt: string | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      cursorCreatedAt = decoded.createdAt;
      cursorId = decoded.id;
    }

    try {
      let query = `
        SELECT 
          f.id,
          f.food_type,
          f.brand_name,
          f.barcode,
          f.status,
          f.category_id,
          f.created_at,
          f.updated_at,
          COALESCE(ft_req.locale, ft_fa.locale, ft_any.locale, ?) AS resolved_locale,
          COALESCE(ft_req.name, ft_fa.name, ft_any.name, 'Unnamed') AS name,
          COALESCE(ft_req.description, ft_fa.description, ft_any.description) AS description,
          COALESCE(ct_req.name, ct_fa.name, ct_any.name) AS category_name,
          fn_energy.amount_per_100g AS energy_kcal,
          fn_protein.amount_per_100g AS protein_g,
          fn_carbs.amount_per_100g AS carbs_g,
          fn_fat.amount_per_100g AS fat_g
        FROM foods f
        LEFT JOIN food_translations ft_req ON f.id = ft_req.food_id AND ft_req.locale = ?
        LEFT JOIN food_translations ft_fa ON f.id = ft_fa.food_id AND ft_fa.locale = 'fa'
        LEFT JOIN (
          SELECT food_id, locale, name, description
          FROM food_translations
          GROUP BY food_id
        ) ft_any ON f.id = ft_any.food_id
        LEFT JOIN food_category_translations ct_req ON f.category_id = ct_req.category_id AND ct_req.locale = ?
        LEFT JOIN food_category_translations ct_fa ON f.category_id = ct_fa.category_id AND ct_fa.locale = 'fa'
        LEFT JOIN (
          SELECT category_id, name
          FROM food_category_translations
          GROUP BY category_id
        ) ct_any ON f.category_id = ct_any.category_id
        LEFT JOIN food_nutrients fn_energy ON f.id = fn_energy.food_id AND fn_energy.nutrient_id = 'nut_energy'
        LEFT JOIN food_nutrients fn_protein ON f.id = fn_protein.food_id AND fn_protein.nutrient_id = 'nut_protein'
        LEFT JOIN food_nutrients fn_carbs ON f.id = fn_carbs.food_id AND fn_carbs.nutrient_id = 'nut_carbohydrate'
        LEFT JOIN food_nutrients fn_fat ON f.id = fn_fat.food_id AND fn_fat.nutrient_id = 'nut_fat_total'
        WHERE 1=1
      `;

      const params: (string | number)[] = [locale, locale, locale];

      if (status && status !== 'all') {
        query += ' AND f.status = ?';
        params.push(status);
      }

      if (categoryId) {
        query += ' AND f.category_id = ?';
        params.push(categoryId);
      }

      if (cursorCreatedAt && cursorId) {
        query += ' AND (f.created_at < ? OR (f.created_at = ? AND f.id < ?))';
        params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
      }

      query += ' ORDER BY f.created_at DESC, f.id DESC LIMIT ?';
      params.push(limit + 1);

      const stmt = this.db.prepare(query).bind(...params);
      const res = await stmt.all<{
        id: string;
        food_type: 'generic' | 'branded';
        brand_name: string | null;
        barcode: string | null;
        status: 'draft' | 'active' | 'archived';
        category_id: string | null;
        created_at: string;
        updated_at: string;
        resolved_locale: string;
        name: string;
        description: string | null;
        category_name: string | null;
        energy_kcal: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
      }>();

      const rows = res.results || [];
      const hasMore = rows.length > limit;
      const sliced = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && sliced.length > 0) {
        const last = sliced[sliced.length - 1]!;
        nextCursor = encodeCursor(last.created_at, last.id);
      }

      const items: FoodSummary[] = sliced.map((r) => {
        const resolvedLocale = (r.resolved_locale || locale) as SupportedLocale;
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          locale: resolvedLocale,
          resolvedLocale,
          requestedLocale: locale,
          foodType: r.food_type,
          brandName: r.brand_name,
          barcode: r.barcode,
          status: r.status,
          categoryId: r.category_id,
          categoryName: r.category_name,
          energyKcal: r.energy_kcal !== null ? Number(r.energy_kcal) : null,
          proteinG: r.protein_g !== null ? Number(r.protein_g) : null,
          carbsG: r.carbs_g !== null ? Number(r.carbs_g) : null,
          fatG: r.fat_g !== null ? Number(r.fat_g) : null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });

      return {
        items,
        nextCursor,
        hasMore,
      };
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        throw err;
      }
      throw new DatabaseError(
        `Failed to list admin foods: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private handleD1ConstraintError(err: unknown, action: string): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed: foods.barcode')) {
      throw new FoodConflictError('A food with this barcode already exists');
    }
    if (msg.includes('UNIQUE constraint failed: foods.source_id, foods.external_id')) {
      throw new FoodConflictError('A food from this source with this external ID already exists');
    }
    if (
      msg.includes('UNIQUE constraint failed: food_translations.food_id, food_translations.locale')
    ) {
      throw new FoodValidationError('Duplicate translation locale for food item');
    }
    if (
      msg.includes('UNIQUE constraint failed: food_nutrients.food_id, food_nutrients.nutrient_id')
    ) {
      throw new FoodValidationError('Duplicate nutrient for food item');
    }
    if (msg.includes('UNIQUE constraint failed: food_servings')) {
      throw new FoodValidationError('Duplicate serving name for food item');
    }
    if (msg.includes('FOREIGN KEY constraint failed')) {
      throw new FoodValidationError(
        'Referenced category, source, or nutrient definition does not exist',
      );
    }
    if (msg.includes('CHECK constraint failed')) {
      throw new FoodValidationError('Invalid food data violating integrity constraints');
    }
    throw new DatabaseError(`Failed to ${action}`);
  }

  async createAtomic(
    food: FoodRecord,
    translations: FoodTranslationRecord[],
    aliases: FoodAliasRecord[],
    nutrients: FoodNutrientRecord[],
    servings: FoodServingRecord[],
  ): Promise<void> {
    try {
      const statements: D1PreparedStatement[] = [
        this.db
          .prepare(
            `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            food.id,
            food.category_id,
            food.food_type,
            food.brand_name,
            food.barcode,
            food.status,
            food.source_id,
            food.external_id,
            food.created_at,
            food.updated_at,
          ),
      ];

      for (const t of translations) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_translations (id, food_id, locale, name, description, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(t.id, t.food_id, t.locale, t.name, t.description, t.created_at, t.updated_at),
        );
      }

      for (const a of aliases) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_aliases (id, food_id, locale, alias, created_at)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(a.id, a.food_id, a.locale, a.alias, a.created_at),
        );
      }

      for (const n of nutrients) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_nutrients (id, food_id, nutrient_id, amount_per_100g, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(n.id, n.food_id, n.nutrient_id, n.amount_per_100g, n.created_at, n.updated_at),
        );
      }

      for (const s of servings) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO food_servings (id, food_id, name_fa, name_en, weight_g, household_unit, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              s.id,
              s.food_id,
              s.name_fa,
              s.name_en,
              s.weight_g,
              s.household_unit,
              s.created_at,
              s.updated_at,
            ),
        );
      }

      await this.db.batch(statements);
    } catch (err) {
      this.handleD1ConstraintError(err, 'atomically create food');
    }
  }

  async updateAtomic(
    food: FoodRecord,
    translations?: FoodTranslationRecord[],
    aliases?: FoodAliasRecord[],
    nutrients?: FoodNutrientRecord[],
    servings?: FoodServingRecord[],
  ): Promise<void> {
    try {
      const statements: D1PreparedStatement[] = [
        this.db
          .prepare(
            `UPDATE foods
             SET category_id = ?, food_type = ?, brand_name = ?, barcode = ?, status = ?, source_id = ?, external_id = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(
            food.category_id,
            food.food_type,
            food.brand_name,
            food.barcode,
            food.status,
            food.source_id,
            food.external_id,
            food.updated_at,
            food.id,
          ),
      ];

      if (translations) {
        statements.push(
          this.db.prepare('DELETE FROM food_translations WHERE food_id = ?').bind(food.id),
        );
        for (const t of translations) {
          statements.push(
            this.db
              .prepare(
                `INSERT INTO food_translations (id, food_id, locale, name, description, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(t.id, t.food_id, t.locale, t.name, t.description, t.created_at, t.updated_at),
          );
        }
      }

      if (aliases) {
        statements.push(
          this.db.prepare('DELETE FROM food_aliases WHERE food_id = ?').bind(food.id),
        );
        for (const a of aliases) {
          statements.push(
            this.db
              .prepare(
                `INSERT INTO food_aliases (id, food_id, locale, alias, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
              )
              .bind(a.id, a.food_id, a.locale, a.alias, a.created_at),
          );
        }
      }

      if (nutrients) {
        statements.push(
          this.db.prepare('DELETE FROM food_nutrients WHERE food_id = ?').bind(food.id),
        );
        for (const n of nutrients) {
          statements.push(
            this.db
              .prepare(
                `INSERT INTO food_nutrients (id, food_id, nutrient_id, amount_per_100g, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
              )
              .bind(n.id, n.food_id, n.nutrient_id, n.amount_per_100g, n.created_at, n.updated_at),
          );
        }
      }

      if (servings) {
        statements.push(
          this.db.prepare('DELETE FROM food_servings WHERE food_id = ?').bind(food.id),
        );
        for (const s of servings) {
          statements.push(
            this.db
              .prepare(
                `INSERT INTO food_servings (id, food_id, name_fa, name_en, weight_g, household_unit, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                s.id,
                s.food_id,
                s.name_fa,
                s.name_en,
                s.weight_g,
                s.household_unit,
                s.created_at,
                s.updated_at,
              ),
          );
        }
      }

      await this.db.batch(statements);
    } catch (err) {
      this.handleD1ConstraintError(err, 'atomically update food');
    }
  }

  async archive(id: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const stmt = this.db
        .prepare("UPDATE foods SET status = 'archived', updated_at = ? WHERE id = ?")
        .bind(now, id);
      const res = await stmt.run();
      return (res.meta.changes ?? 0) > 0;
    } catch (err) {
      throw new DatabaseError(
        `Failed to archive food: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
