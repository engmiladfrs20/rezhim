import type { D1Database } from '@cloudflare/workers-types';
import type { NutrientDefinitionRecord } from './models';
import { DatabaseError } from './errors';

export class NutrientRepository {
  constructor(private readonly db: D1Database) {}

  async listAll(): Promise<NutrientDefinitionRecord[]> {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM nutrient_definitions ORDER BY sort_order ASC, code ASC',
      );
      const res = await stmt.all<NutrientDefinitionRecord>();
      return res.results || [];
    } catch (err) {
      throw new DatabaseError(
        `Failed to list nutrient definitions: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findById(id: string): Promise<NutrientDefinitionRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM nutrient_definitions WHERE id = ?').bind(id);
      return await stmt.first<NutrientDefinitionRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find nutrient by ID: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findByCode(code: string): Promise<NutrientDefinitionRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM nutrient_definitions WHERE code = ?').bind(code);
      return await stmt.first<NutrientDefinitionRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find nutrient by code: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
