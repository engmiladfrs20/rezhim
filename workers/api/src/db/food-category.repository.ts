import type { D1Database } from '@cloudflare/workers-types';
import type { FoodCategoryRecord, FoodCategoryTranslationRecord } from './models';
import { DatabaseError } from './errors';

export interface CategoryWithTranslations {
  category: FoodCategoryRecord;
  translations: FoodCategoryTranslationRecord[];
}

export class FoodCategoryRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<FoodCategoryRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM food_categories WHERE id = ?').bind(id);
      return await stmt.first<FoodCategoryRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food category by ID: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findBySlug(slug: string): Promise<FoodCategoryRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM food_categories WHERE slug = ?').bind(slug);
      return await stmt.first<FoodCategoryRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food category by slug: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getTranslationsForCategory(categoryId: string): Promise<FoodCategoryTranslationRecord[]> {
    try {
      const stmt = this.db
        .prepare(
          'SELECT * FROM food_category_translations WHERE category_id = ? ORDER BY locale ASC',
        )
        .bind(categoryId);
      const res = await stmt.all<FoodCategoryTranslationRecord>();
      return res.results || [];
    } catch (err) {
      throw new DatabaseError(
        `Failed to get translations for category: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listAll(status?: 'active' | 'archived' | 'all'): Promise<CategoryWithTranslations[]> {
    try {
      let query = 'SELECT * FROM food_categories';
      const params: string[] = [];
      if (status && status !== 'all') {
        query += ' WHERE status = ?';
        params.push(status);
      }
      query += ' ORDER BY created_at ASC';

      const catStmt =
        params.length > 0 ? this.db.prepare(query).bind(...params) : this.db.prepare(query);
      const catRes = await catStmt.all<FoodCategoryRecord>();
      const categories = catRes.results || [];

      if (categories.length === 0) {
        return [];
      }

      // Fetch all translations
      const transStmt = this.db.prepare('SELECT * FROM food_category_translations');
      const transRes = await transStmt.all<FoodCategoryTranslationRecord>();
      const translations = transRes.results || [];

      const transMap = new Map<string, FoodCategoryTranslationRecord[]>();
      for (const t of translations) {
        const list = transMap.get(t.category_id) || [];
        list.push(t);
        transMap.set(t.category_id, list);
      }

      return categories.map((c) => ({
        category: c,
        translations: transMap.get(c.id) || [],
      }));
    } catch (err) {
      throw new DatabaseError(
        `Failed to list food categories: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async createAtomic(
    category: FoodCategoryRecord,
    translations: FoodCategoryTranslationRecord[],
  ): Promise<void> {
    try {
      const statements = [
        this.db
          .prepare(
            'INSERT INTO food_categories (id, slug, parent_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(
            category.id,
            category.slug,
            category.parent_id,
            category.status,
            category.created_at,
            category.updated_at,
          ),
      ];

      for (const t of translations) {
        statements.push(
          this.db
            .prepare(
              'INSERT INTO food_category_translations (id, category_id, locale, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(t.id, t.category_id, t.locale, t.name, t.description, t.created_at, t.updated_at),
        );
      }

      await this.db.batch(statements);
    } catch (err) {
      throw new DatabaseError(
        `Failed to atomically create category: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
