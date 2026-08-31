import type { D1Database } from '@cloudflare/workers-types';
import type {
  FastingStartInputDto,
  HabitCreateInputDto,
  HabitUpdateInputDto,
  LifestyleDateQueryDto,
  WaterIntakeCreateInputDto,
} from '@nutriai/schemas';
import type { DailyLifestyleSummary, FastingSession, HabitLog, WaterIntake } from '@nutriai/types';
import { DatabaseError } from '../db/errors';
import type { FastingSessionRecord, HabitLogRecord, WaterIntakeRecord } from '../db/models';
import { LifestyleRepository } from '../db/lifestyle.repository';

export class LifestyleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifestyleNotFoundError';
  }
}

export class LifestyleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifestyleConflictError';
  }
}

export class LifestyleService {
  constructor(private readonly repo: LifestyleRepository) {}

  static fromDatabase(db: D1Database): LifestyleService {
    return new LifestyleService(new LifestyleRepository(db));
  }

  private water(record: WaterIntakeRecord): WaterIntake {
    return {
      id: record.id,
      userId: record.user_id,
      amountMl: Number(record.amount_ml),
      consumedAt: record.consumed_at,
      createdAt: record.created_at,
    };
  }

  private fasting(record: FastingSessionRecord): FastingSession {
    return {
      id: record.id,
      userId: record.user_id,
      startedAt: record.started_at,
      endedAt: record.ended_at,
      goalHours: Number(record.goal_hours),
      status: record.status,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private habit(record: HabitLogRecord): HabitLog {
    return {
      id: record.id,
      userId: record.user_id,
      habitKey: record.habit_key,
      occurredOn: record.occurred_on,
      completed: Boolean(record.completed),
      note: record.note,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  async summary(userId: string, query: LifestyleDateQueryDto): Promise<DailyLifestyleSummary> {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    const [waterRecords, fastingRecords, activeRecord, habitRecords] = await Promise.all([
      this.repo.listWater(userId, date),
      this.repo.listFasting(userId, date),
      this.repo.findActiveFasting(userId),
      this.repo.listHabits(userId, date),
    ]);
    const waterEntries = waterRecords.map((record) => this.water(record));
    return {
      date,
      waterTotalMl: waterEntries.reduce((total, entry) => total + entry.amountMl, 0),
      waterEntries,
      activeFast: activeRecord ? this.fasting(activeRecord) : null,
      fastingSessions: fastingRecords.map((record) => this.fasting(record)),
      habits: habitRecords.map((record) => this.habit(record)),
    };
  }

  async listWater(userId: string, query: LifestyleDateQueryDto): Promise<WaterIntake[]> {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    return (await this.repo.listWater(userId, date)).map((record) => this.water(record));
  }

  async createWater(userId: string, input: WaterIntakeCreateInputDto): Promise<WaterIntake> {
    const record: WaterIntakeRecord = {
      id: `water_${crypto.randomUUID()}`,
      user_id: userId,
      amount_ml: input.amount_ml,
      consumed_at: input.consumed_at,
      created_at: new Date().toISOString(),
    };
    await this.repo.createWater(record);
    return this.water(record);
  }

  async listFasting(userId: string, query: LifestyleDateQueryDto): Promise<FastingSession[]> {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    return (await this.repo.listFasting(userId, date)).map((record) => this.fasting(record));
  }

  async startFasting(userId: string, input: FastingStartInputDto): Promise<FastingSession> {
    const current = await this.repo.findActiveFasting(userId);
    if (current) throw new LifestyleConflictError('An active fasting session already exists.');
    const startedAt = input.started_at ?? new Date().toISOString();
    if (startedAt > new Date().toISOString()) {
      throw new DatabaseError('Fasting cannot start in the future.', 'VALIDATION_ERROR');
    }
    const now = new Date().toISOString();
    const record: FastingSessionRecord = {
      id: `fast_${crypto.randomUUID()}`,
      user_id: userId,
      started_at: startedAt,
      ended_at: null,
      goal_hours: input.goal_hours,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    try {
      await this.repo.createFasting(record);
    } catch (error) {
      if (error instanceof DatabaseError && error.code === 'CONFLICT') {
        throw new LifestyleConflictError(error.message);
      }
      throw error;
    }
    return this.fasting(record);
  }

  async stopFasting(userId: string, id: string): Promise<FastingSession> {
    const endedAt = new Date().toISOString();
    const record = await this.repo.completeFasting(id, userId, endedAt, endedAt);
    if (!record) throw new LifestyleNotFoundError('Active fasting session not found.');
    return this.fasting(record);
  }

  async listHabits(userId: string, query: LifestyleDateQueryDto): Promise<HabitLog[]> {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    return (await this.repo.listHabits(userId, date)).map((record) => this.habit(record));
  }

  async createHabit(userId: string, input: HabitCreateInputDto): Promise<HabitLog> {
    const now = new Date().toISOString();
    const record: HabitLogRecord = {
      id: `habit_${crypto.randomUUID()}`,
      user_id: userId,
      habit_key: input.habit_key,
      occurred_on: input.occurred_on,
      completed: input.completed ? 1 : 0,
      note: input.note ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.repo.createHabit(record);
    return this.habit(record);
  }

  async updateHabit(userId: string, id: string, input: HabitUpdateInputDto): Promise<HabitLog> {
    const existing = await this.repo.findHabit(id, userId);
    if (!existing) throw new LifestyleNotFoundError('Habit log not found.');
    const record: HabitLogRecord = {
      ...existing,
      completed: input.completed === undefined ? existing.completed : input.completed ? 1 : 0,
      note: input.note === undefined ? existing.note : input.note,
      updated_at: new Date().toISOString(),
    };
    await this.repo.updateHabit(record);
    return this.habit(record);
  }

  async deleteHabit(userId: string, id: string): Promise<void> {
    if (!(await this.repo.deleteHabit(id, userId))) {
      throw new LifestyleNotFoundError('Habit log not found.');
    }
  }
}
