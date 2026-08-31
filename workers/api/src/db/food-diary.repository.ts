import type { D1Database } from '@cloudflare/workers-types';
import type { FoodDiaryEntryRecord } from './models';
import { DatabaseError } from './errors';

export class FoodDiaryRepository {
  constructor(private readonly db: D1Database) {}

  async create(entry: FoodDiaryEntryRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO food_diary_entries
             (id, user_id, food_id, serving_id, grams, quantity, meal_type, consumed_at, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          entry.id,
          entry.user_id,
          entry.food_id,
          entry.serving_id,
          entry.grams,
          entry.quantity,
          entry.meal_type,
          entry.consumed_at,
          entry.note,
          entry.created_at,
          entry.updated_at,
        )
        .run();
    } catch (err) {
      throw new DatabaseError(
        `Failed to create food diary entry: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<FoodDiaryEntryRecord | null> {
    try {
      return await this.db
        .prepare('SELECT * FROM food_diary_entries WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .first<FoodDiaryEntryRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find food diary entry: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listByUserAndDate(userId: string, date: string): Promise<FoodDiaryEntryRecord[]> {
    const start = `${date}T00:00:00.000Z`;
    const nextDate = new Date(`${date}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const end = nextDate.toISOString();

    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM food_diary_entries
           WHERE user_id = ? AND consumed_at >= ? AND consumed_at < ?
           ORDER BY consumed_at ASC, id ASC`,
        )
        .bind(userId, start, end)
        .all<FoodDiaryEntryRecord>();
      return result.results ?? [];
    } catch (err) {
      throw new DatabaseError(
        `Failed to list food diary entries: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async update(entry: FoodDiaryEntryRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `UPDATE food_diary_entries
           SET food_id = ?, serving_id = ?, grams = ?, quantity = ?, meal_type = ?, consumed_at = ?, note = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
        )
        .bind(
          entry.food_id,
          entry.serving_id,
          entry.grams,
          entry.quantity,
          entry.meal_type,
          entry.consumed_at,
          entry.note,
          entry.updated_at,
          entry.id,
          entry.user_id,
        )
        .run();
    } catch (err) {
      throw new DatabaseError(
        `Failed to update food diary entry: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('DELETE FROM food_diary_entries WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    } catch (err) {
      throw new DatabaseError(
        `Failed to delete food diary entry: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
