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

  async upsert(record: FoodSourceRecord): Promise<void> {
    try {
      const stmt = this.db
        .prepare(
          `INSERT INTO food_sources (id, name, code, description, url, license, acquisition_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             code = excluded.code,
             description = excluded.description,
             url = excluded.url,
             license = excluded.license,
             acquisition_date = excluded.acquisition_date,
             updated_at = excluded.updated_at`,
        )
        .bind(
          record.id,
          record.name,
          record.code,
          record.description,
          record.url,
          record.license,
          record.acquisition_date,
          record.created_at,
          record.updated_at,
        );
      await stmt.run();
    } catch (err) {
      throw new DatabaseError(
        `Failed to upsert food source: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
