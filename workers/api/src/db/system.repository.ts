import type { D1Database } from '@cloudflare/workers-types';
import type { SystemMetadata } from '@nutriai/types';
import { SystemMetadataSchema } from '@nutriai/schemas';
import { DatabaseError, ReadinessError } from './errors';

export class SystemRepository {
  constructor(private readonly db: D1Database | undefined) {}

  private getDB(): D1Database {
    if (!this.db) {
      throw new ReadinessError('Database binding (DB) is missing in the environment scope.');
    }
    return this.db;
  }

  async testConnection(): Promise<boolean> {
    try {
      const db = this.getDB();
      const stmt = db.prepare('SELECT 1 as alive');
      const result = await stmt.first<{ alive: number }>();
      return result?.alive === 1;
    } catch (err) {
      if (err instanceof ReadinessError) {
        throw err;
      }
      throw new DatabaseError('Failed to establish readiness check ping to D1.');
    }
  }

  async getMetadata(key: string): Promise<SystemMetadata | null> {
    try {
      const db = this.getDB();
      const stmt = db
        .prepare('SELECT id, key, value, updated_at FROM system_metadata WHERE key = ?')
        .bind(key);
      const result = await stmt.first<SystemMetadata>();
      if (!result) return null;

      // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" which fails Zod datetime() strict checks
      if (
        result.updated_at &&
        typeof result.updated_at === 'string' &&
        !result.updated_at.includes('T')
      ) {
        result.updated_at = result.updated_at.replace(' ', 'T') + 'Z';
      }

      const parsed = SystemMetadataSchema.safeParse(result);
      if (!parsed.success) {
        throw new DatabaseError(`Invalid database payload for key: ${key}`);
      }

      return parsed.data as unknown as SystemMetadata;
    } catch (err) {
      if (err instanceof ReadinessError) {
        throw err;
      }
      throw new DatabaseError(`Failed to retrieve system metadata for key: ${key}`);
    }
  }

  // Included for testing bounds
  async setMetadata(id: string, key: string, value: string, updatedAt: string): Promise<void> {
    try {
      const db = this.getDB();
      const stmt = db
        .prepare(
          'INSERT INTO system_metadata (id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        )
        .bind(id, key, value, updatedAt);
      await stmt.run();
    } catch (err) {
      if (err instanceof ReadinessError) {
        throw err;
      }
      throw new DatabaseError(`Failed to upsert system metadata for key: ${key}`);
    }
  }
}
