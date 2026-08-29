import type { D1Database } from '@cloudflare/workers-types';
import { DatabaseError } from './errors';

export class LoginAttemptRepository {
  constructor(private readonly db?: D1Database | undefined) {}

  private getDb(): D1Database {
    if (!this.db) {
      throw new DatabaseError('Database binding (DB) is missing in the environment scope.');
    }
    return this.db;
  }

  async cleanStaleAttempts(limitWindowIso: string): Promise<void> {
    try {
      await this.getDb()
        .prepare('DELETE FROM auth_login_attempts WHERE window_start < ?')
        .bind(limitWindowIso)
        .run();
    } catch {
      throw new DatabaseError('Failed to clean stale login attempts');
    }
  }

  async recordAttempt(
    emailHash: string,
    ipHash: string,
    limitWindowIso: string,
    attemptedAt: string,
  ): Promise<number> {
    try {
      await this.cleanStaleAttempts(limitWindowIso);

      const stmt = this.getDb()
        .prepare(
          `
        INSERT INTO auth_login_attempts (email_hash, ip_hash, window_start, attempts)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(email_hash, ip_hash) DO UPDATE SET
          attempts = CASE
            WHEN auth_login_attempts.window_start >= ? THEN auth_login_attempts.attempts + 1
            ELSE 1
          END,
          window_start = CASE
            WHEN auth_login_attempts.window_start >= ? THEN auth_login_attempts.window_start
            ELSE ?
          END
        RETURNING attempts as count
      `,
        )
        .bind(emailHash, ipHash, attemptedAt, limitWindowIso, limitWindowIso, attemptedAt);

      const result = await stmt.first<{ count: number }>();
      return result?.count ?? 0;
    } catch {
      throw new DatabaseError('Failed to record login attempt');
    }
  }

  async clearAttempts(emailHash: string, ipHash: string): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare('DELETE FROM auth_login_attempts WHERE email_hash = ? AND ip_hash = ?')
        .bind(emailHash, ipHash);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to clear login attempts`);
    }
  }
}
