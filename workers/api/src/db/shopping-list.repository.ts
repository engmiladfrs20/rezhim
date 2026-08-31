import type { D1Database } from '@cloudflare/workers-types';
import type { ShoppingListItemRecord } from './models';
import { DatabaseError } from './errors';

export class ShoppingListRepository {
  constructor(private readonly db: D1Database) {}

  async create(item: ShoppingListItemRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO shopping_list_items
           (id, user_id, food_id, required_grams, purchased_grams, status, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          item.id,
          item.user_id,
          item.food_id,
          item.required_grams,
          item.purchased_grams,
          item.status,
          item.note,
          item.created_at,
          item.updated_at,
        )
        .run();
    } catch (err) {
      throw new DatabaseError(
        `Failed to create shopping-list item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<ShoppingListItemRecord | null> {
    try {
      return await this.db
        .prepare('SELECT * FROM shopping_list_items WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .first<ShoppingListItemRecord>();
    } catch (err) {
      throw new DatabaseError(
        `Failed to find shopping-list item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listByUser(
    userId: string,
    status?: ShoppingListItemRecord['status'],
  ): Promise<ShoppingListItemRecord[]> {
    try {
      const query = status
        ? 'SELECT * FROM shopping_list_items WHERE user_id = ? AND status = ? ORDER BY created_at DESC, id DESC'
        : 'SELECT * FROM shopping_list_items WHERE user_id = ? ORDER BY created_at DESC, id DESC';
      const statement = status
        ? this.db.prepare(query).bind(userId, status)
        : this.db.prepare(query).bind(userId);
      const result = await statement.all<ShoppingListItemRecord>();
      return result.results ?? [];
    } catch (err) {
      throw new DatabaseError(
        `Failed to list shopping-list items: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async update(item: ShoppingListItemRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `UPDATE shopping_list_items
           SET food_id = ?, required_grams = ?, purchased_grams = ?, status = ?, note = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
        )
        .bind(
          item.food_id,
          item.required_grams,
          item.purchased_grams,
          item.status,
          item.note,
          item.updated_at,
          item.id,
          item.user_id,
        )
        .run();
    } catch (err) {
      throw new DatabaseError(
        `Failed to update shopping-list item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('DELETE FROM shopping_list_items WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    } catch (err) {
      throw new DatabaseError(
        `Failed to delete shopping-list item: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
