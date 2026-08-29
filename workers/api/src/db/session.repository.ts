import type { D1Database } from '@cloudflare/workers-types';
import type { AuthSessionRecord } from './models';
import { DatabaseError } from './errors';

export class SessionRepository {
  constructor(private readonly db?: D1Database | undefined) {}

  private getDb(): D1Database {
    if (!this.db) {
      throw new DatabaseError('Database binding (DB) is missing in the environment scope.');
    }
    return this.db;
  }

  async createSession(session: AuthSessionRecord): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare(
          `
        INSERT INTO auth_sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          session.id,
          session.user_id,
          session.token_hash,
          session.created_at,
          session.last_seen_at,
          session.expires_at,
          session.revoked_at,
        );
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to insert auth session`);
    }
  }

  async findByRawHash(hash: string): Promise<AuthSessionRecord | null> {
    try {
      const stmt = this.getDb()
        .prepare('SELECT * FROM auth_sessions WHERE token_hash = ?')
        .bind(hash);
      return await stmt.first<AuthSessionRecord>();
    } catch {
      throw new DatabaseError(`Failed to fetch auth session`);
    }
  }

  async revokeSession(id: string, revokedAt: string): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare('UPDATE auth_sessions SET revoked_at = ? WHERE id = ?')
        .bind(revokedAt, id);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to revoke session`);
    }
  }

  async revokeAllUserSessions(userId: string, revokedAt: string): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
        .bind(revokedAt, userId);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to revoke all user sessions`);
    }
  }

  async revokeOtherUserSessions(
    userId: string,
    currentSessionId: string,
    revokedAt: string,
  ): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare(
          'UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL',
        )
        .bind(revokedAt, userId, currentSessionId);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to revoke other sessions`);
    }
  }

  async updateLastSeen(id: string, timestamp: string): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?')
        .bind(timestamp, id);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to touch session`);
    }
  }
}
