import type { D1Database } from '@cloudflare/workers-types';
import type { PantryItemRecord } from './models';
import { DatabaseError } from './errors';

export class PantryRepository {
  constructor(private readonly db: D1Database) {}

  async create(item: PantryItemRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO pantry_items
           (id, user_id, food_id, location, quantity_grams, expires_at, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          item.id,
          item.user_id,
          item.food_id,
          item.location,
          item.quantity_grams,
          item.expires_at,
          item.note,
          item.created_at,
          item.updated_at,
        )
        .run();
    } catch (err) {
      throw new DatabaseError(
        `Failed to create pantry item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<PantryItemRecord | null> {
    try {
      return await this.db
        .prepare('SELECT * FROM pantry_items WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .first<PantryItemRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find pantry item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listByUser(
    userId: string,
    location?: PantryItemRecord['location'],
  ): Promise<PantryItemRecord[]> {
    try {
      const query = location
        ? 'SELECT * FROM pantry_items WHERE user_id = ? AND location = ? ORDER BY created_at DESC, id DESC'
        : 'SELECT * FROM pantry_items WHERE user_id = ? ORDER BY created_at DESC, id DESC';
      const statement = location
        ? this.db.prepare(query).bind(userId, location)
        : this.db.prepare(query).bind(userId);
      const result = await statement.all<PantryItemRecord>();
      return result.results ?? [];
    } catch (err) {
      throw new DatabaseError(
        `Failed to list pantry items: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async update(item: PantryItemRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `UPDATE pantry_items
           SET food_id = ?, location = ?, quantity_grams = ?, expires_at = ?, note = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
        )
        .bind(
          item.food_id,
          item.location,
          item.quantity_grams,
          item.expires_at,
          item.note,
          item.updated_at,
          item.id,
          item.user_id,
        )
        .run();
    } catch (err) {
      throw new DatabaseError(
        `Failed to update pantry item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('DELETE FROM pantry_items WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    } catch (err) {
      throw new DatabaseError(
        `Failed to delete pantry item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
