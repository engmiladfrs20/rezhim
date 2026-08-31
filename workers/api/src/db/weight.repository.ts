import type { D1Database } from '@cloudflare/workers-types';
import type { WeightEntryRecord } from './models';
import { DatabaseError } from './errors';

export class WeightRepository {
  constructor(private readonly db: D1Database) {}

  async create(entry: WeightEntryRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO user_weight_entries
             (id, user_id, weight_kg, measured_at, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          entry.id,
          entry.user_id,
          entry.weight_kg,
          entry.measured_at,
          entry.note,
          entry.created_at,
          entry.updated_at,
        )
        .run();
    } catch (err) {
      if (err instanceof Error && /unique/i.test(err.message)) {
        throw new DatabaseError(
          'A weight entry already exists for this measurement time.',
          'CONFLICT',
        );
      }
      throw new DatabaseError('Failed to create weight entry.');
    }
  }

  async listByUser(
    userId: string,
    from: string | undefined,
    to: string | undefined,
    limit: number,
  ): Promise<WeightEntryRecord[]> {
    const clauses = ['user_id = ?'];
    const binds: (string | number)[] = [userId];
    if (from) {
      clauses.push('measured_at >= ?');
      binds.push(`${from}T00:00:00.000Z`);
    }
    if (to) {
      const next = new Date(`${to}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      clauses.push('measured_at < ?');
      binds.push(next.toISOString());
    }
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM user_weight_entries
           WHERE ${clauses.join(' AND ')}
           ORDER BY measured_at ASC, id ASC LIMIT ?`,
        )
        .bind(...binds, limit)
        .all<WeightEntryRecord>();
      return result.results ?? [];
    } catch {
      throw new DatabaseError('Failed to list weight entries.');
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<WeightEntryRecord | null> {
    try {
      return await this.db
        .prepare('SELECT * FROM user_weight_entries WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .first<WeightEntryRecord>();
    } catch {
      throw new DatabaseError('Failed to find weight entry.');
    }
  }

  async update(entry: WeightEntryRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `UPDATE user_weight_entries
           SET weight_kg = ?, measured_at = ?, note = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
        )
        .bind(
          entry.weight_kg,
          entry.measured_at,
          entry.note,
          entry.updated_at,
          entry.id,
          entry.user_id,
        )
        .run();
    } catch (err) {
      if (err instanceof Error && /unique/i.test(err.message)) {
        throw new DatabaseError(
          'A weight entry already exists for this measurement time.',
          'CONFLICT',
        );
      }
      throw new DatabaseError('Failed to update weight entry.');
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('DELETE FROM user_weight_entries WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    } catch {
      throw new DatabaseError('Failed to delete weight entry.');
    }
  }
}
