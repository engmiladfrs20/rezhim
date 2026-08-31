import type { D1Database } from '@cloudflare/workers-types';
import type { FastingSessionRecord, HabitLogRecord, WaterIntakeRecord } from './models';
import { DatabaseError } from './errors';

function dayBounds(date: string): { start: string; end: string } {
  const start = `${date}T00:00:00.000Z`;
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, end: next.toISOString() };
}

export class LifestyleRepository {
  constructor(private readonly db: D1Database) {}

  async createWater(entry: WaterIntakeRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO water_intakes (id, user_id, amount_ml, consumed_at, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(entry.id, entry.user_id, entry.amount_ml, entry.consumed_at, entry.created_at)
        .run();
    } catch {
      throw new DatabaseError('Failed to create water intake.');
    }
  }

  async listWater(userId: string, date: string): Promise<WaterIntakeRecord[]> {
    const bounds = dayBounds(date);
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM water_intakes
           WHERE user_id = ? AND consumed_at >= ? AND consumed_at < ?
           ORDER BY consumed_at ASC, id ASC`,
        )
        .bind(userId, bounds.start, bounds.end)
        .all<WaterIntakeRecord>();
      return result.results ?? [];
    } catch {
      throw new DatabaseError('Failed to list water intakes.');
    }
  }

  async findActiveFasting(userId: string): Promise<FastingSessionRecord | null> {
    try {
      return await this.db
        .prepare("SELECT * FROM fasting_sessions WHERE user_id = ? AND status = 'active' LIMIT 1")
        .bind(userId)
        .first<FastingSessionRecord>();
    } catch {
      throw new DatabaseError('Failed to find active fasting session.');
    }
  }

  async createFasting(session: FastingSessionRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO fasting_sessions
             (id, user_id, started_at, ended_at, goal_hours, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          session.id,
          session.user_id,
          session.started_at,
          session.ended_at,
          session.goal_hours,
          session.status,
          session.created_at,
          session.updated_at,
        )
        .run();
    } catch (error) {
      if (error instanceof Error && /unique|constraint/i.test(error.message)) {
        throw new DatabaseError('An active fasting session already exists.', 'CONFLICT');
      }
      throw new DatabaseError('Failed to create fasting session.');
    }
  }

  async listFasting(userId: string, date: string): Promise<FastingSessionRecord[]> {
    const bounds = dayBounds(date);
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM fasting_sessions
           WHERE user_id = ? AND started_at < ? AND (ended_at IS NULL OR ended_at >= ?)
           ORDER BY started_at ASC, id ASC`,
        )
        .bind(userId, bounds.end, bounds.start)
        .all<FastingSessionRecord>();
      return result.results ?? [];
    } catch {
      throw new DatabaseError('Failed to list fasting sessions.');
    }
  }

  async completeFasting(
    id: string,
    userId: string,
    endedAt: string,
    updatedAt: string,
  ): Promise<FastingSessionRecord | null> {
    try {
      const result = await this.db
        .prepare(
          `UPDATE fasting_sessions
           SET ended_at = ?, status = 'completed', updated_at = ?
           WHERE id = ? AND user_id = ? AND status = 'active'`,
        )
        .bind(endedAt, updatedAt, id, userId)
        .run();
      if ((result.meta.changes ?? 0) === 0) return null;
      return await this.db
        .prepare('SELECT * FROM fasting_sessions WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .first<FastingSessionRecord>();
    } catch {
      throw new DatabaseError('Failed to complete fasting session.');
    }
  }

  async createHabit(habit: HabitLogRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO habit_logs
             (id, user_id, habit_key, occurred_on, completed, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          habit.id,
          habit.user_id,
          habit.habit_key,
          habit.occurred_on,
          habit.completed,
          habit.note,
          habit.created_at,
          habit.updated_at,
        )
        .run();
    } catch (error) {
      if (error instanceof Error && /unique|constraint/i.test(error.message)) {
        throw new DatabaseError('This habit is already logged for the selected date.', 'CONFLICT');
      }
      throw new DatabaseError('Failed to create habit log.');
    }
  }

  async listHabits(userId: string, date: string): Promise<HabitLogRecord[]> {
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM habit_logs
           WHERE user_id = ? AND occurred_on = ?
           ORDER BY habit_key ASC, id ASC`,
        )
        .bind(userId, date)
        .all<HabitLogRecord>();
      return result.results ?? [];
    } catch {
      throw new DatabaseError('Failed to list habit logs.');
    }
  }

  async findHabit(id: string, userId: string): Promise<HabitLogRecord | null> {
    try {
      return await this.db
        .prepare('SELECT * FROM habit_logs WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .first<HabitLogRecord>();
    } catch {
      throw new DatabaseError('Failed to find habit log.');
    }
  }

  async updateHabit(habit: HabitLogRecord): Promise<void> {
    try {
      await this.db
        .prepare(
          `UPDATE habit_logs SET completed = ?, note = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
        )
        .bind(habit.completed, habit.note, habit.updated_at, habit.id, habit.user_id)
        .run();
    } catch {
      throw new DatabaseError('Failed to update habit log.');
    }
  }

  async deleteHabit(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('DELETE FROM habit_logs WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    } catch {
      throw new DatabaseError('Failed to delete habit log.');
    }
  }
}
