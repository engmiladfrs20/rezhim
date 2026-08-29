import type { D1Database } from '@cloudflare/workers-types';
import type { FoodSourceRecord } from './models';
import { DatabaseError } from './errors';

export class FoodSourceRepository {
  constructor(private readonly db: D1Database) {}

  async listAll(): Promise<FoodSourceRecord[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM food_sources ORDER BY name ASC');
      const res = await stmt.all<FoodSourceRecord>();
      return res.results || [];
    } catch (err) {
      throw new DatabaseError(
        `Failed to list food sources: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findById(id: string): Promise<FoodSourceRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM food_sources WHERE id = ?').bind(id);
      return await stmt.first<FoodSourceRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food source by ID: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findByCode(code: string): Promise<FoodSourceRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM food_sources WHERE code = ?').bind(code);
      return await stmt.first<FoodSourceRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food source by code: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
