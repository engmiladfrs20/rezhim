import type { D1Database } from '@cloudflare/workers-types';
import type { UserRecord } from './models';
import { DatabaseError } from './errors';

export class UserRepository {
  constructor(private readonly db?: D1Database | undefined) {}

  private getDb(): D1Database {
    if (!this.db) {
      throw new DatabaseError('Database binding (DB) is missing in the environment scope.');
    }
    return this.db;
  }

  async findByNormalizedEmail(emailNormalized: string): Promise<UserRecord | null> {
    try {
      const stmt = this.getDb()
        .prepare('SELECT * FROM users WHERE email_normalized = ?')
        .bind(emailNormalized);
      return await stmt.first<UserRecord>();
    } catch {
      throw new DatabaseError(`Failed to lookup user by email`);
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    try {
      const stmt = this.getDb().prepare('SELECT * FROM users WHERE id = ?').bind(id);
      return await stmt.first<UserRecord>();
    } catch {
      throw new DatabaseError(`Failed to fetch user by ID`);
    }
  }

  async createUser(user: UserRecord): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare(
          `
        INSERT INTO users (
          id, email, email_normalized, password_hash, password_salt,
          password_algorithm, password_iterations, display_name, role, status,
          locale, email_verified_at, last_login_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          user.id,
          user.email,
          user.email_normalized,
          user.password_hash,
          user.password_salt,
          user.password_algorithm,
          user.password_iterations,
          user.display_name,
          user.role,
          user.status,
          user.locale,
          user.email_verified_at,
          user.last_login_at,
          user.created_at,
          user.updated_at,
        );
      await stmt.run();
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message?.includes('UNIQUE constraint failed: users.email_normalized')
      ) {
        throw new DatabaseError('EMAIL_EXISTS');
      }
      throw new DatabaseError(`Failed to execute user creation`);
    }
  }

  async recordLogin(id: string, timestampIso: string): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
        .bind(timestampIso, timestampIso, id);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to record login`);
    }
  }

  async updatePassword(
    id: string,
    hash: string,
    salt: string,
    iterations: number,
    algorithm: string,
    updatedAt: string,
  ): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare(
          `
        UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, password_algorithm = ?, updated_at = ? WHERE id = ?
      `,
        )
        .bind(hash, salt, iterations, algorithm, updatedAt, id);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to update password`);
    }
  }

  async updateProfile(
    id: string,
    updates: { display_name?: string | undefined; locale?: 'fa' | 'en' | undefined },
    updatedAt: string,
  ): Promise<void> {
    try {
      let query = 'UPDATE users SET updated_at = ?';
      const binds: string[] = [updatedAt];
      if (updates.display_name) {
        query += ', display_name = ?';
        binds.push(updates.display_name);
      }
      if (updates.locale) {
        query += ', locale = ?';
        binds.push(updates.locale);
      }
      query += ' WHERE id = ?';
      binds.push(id);

      const stmt = this.getDb()
        .prepare(query)
        .bind(...binds);
      await stmt.run();
    } catch {
      throw new DatabaseError(`Failed to update user profile`);
    }
  }

  async listUsers(
    limit: number,
    cursor: string | null,
    role: string | null,
    status: string | null,
  ): Promise<UserRecord[]> {
    try {
      let query = 'SELECT * FROM users WHERE 1=1';
      const binds: (string | number)[] = [];

      if (role) {
        query += ' AND role = ?';
        binds.push(role);
      }
      if (status) {
        query += ' AND status = ?';
        binds.push(status);
      }
      if (cursor) {
        query += ' AND id > ?';
        binds.push(cursor);
      }

      query += ' ORDER BY id ASC LIMIT ?';
      binds.push(limit);

      const stmt = this.getDb()
        .prepare(query)
        .bind(...binds);
      const results = await stmt.all<UserRecord>();
      return results.results || [];
    } catch {
      throw new DatabaseError('Failed to list users');
    }
  }

  async updateStatus(id: string, status: string, updatedAt: string): Promise<void> {
    try {
      const stmt = this.getDb()
        .prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
        .bind(status, updatedAt, id);
      await stmt.run();
    } catch {
      throw new DatabaseError('Failed to update user status');
    }
  }
}
