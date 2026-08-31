import type { D1Database } from '@cloudflare/workers-types';
import type {
  WeightEntryCreateInputDto,
  WeightEntryUpdateInputDto,
  WeightTrendQueryDto,
} from '@nutriai/schemas';
import type { WeightEntry, WeightTrend } from '@nutriai/types';
import { WeightRepository } from '../db/weight.repository';
import type { WeightEntryRecord } from '../db/models';
import { DatabaseError } from '../db/errors';

export class WeightEntryNotFoundError extends Error {
  constructor() {
    super('Weight entry not found.');
    this.name = 'WeightEntryNotFoundError';
  }
}

export class ProgressService {
  constructor(private readonly repo: WeightRepository) {}

  static fromDatabase(db: D1Database): ProgressService {
    return new ProgressService(new WeightRepository(db));
  }

  private toDomain(record: WeightEntryRecord): WeightEntry {
    return {
      id: record.id,
      userId: record.user_id,
      weightKg: Number(record.weight_kg),
      measuredAt: record.measured_at,
      note: record.note,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  async list(userId: string, query: WeightTrendQueryDto): Promise<WeightTrend> {
    if (query.from && query.to && query.from > query.to) {
      throw new DatabaseError('The from date must not be after the to date.', 'VALIDATION_ERROR');
    }
    const entries = (await this.repo.listByUser(userId, query.from, query.to, query.limit)).map(
      (e) => this.toDomain(e),
    );
    const weights = entries.map((entry) => entry.weightKg);
    const first = weights[0] ?? null;
    const latest = weights.at(-1) ?? null;
    const change = first === null || latest === null ? null : Number((latest - first).toFixed(2));
    return {
      entries,
      firstWeightKg: first,
      latestWeightKg: latest,
      changeKg: change,
      changePercent:
        first === null || first === 0 || change === null
          ? null
          : Number(((change / first) * 100).toFixed(2)),
      lowestWeightKg: weights.length ? Math.min(...weights) : null,
      highestWeightKg: weights.length ? Math.max(...weights) : null,
    };
  }

  async create(userId: string, input: WeightEntryCreateInputDto): Promise<WeightEntry> {
    const now = new Date().toISOString();
    const record: WeightEntryRecord = {
      id: `weight_${crypto.randomUUID()}`,
      user_id: userId,
      weight_kg: input.weight_kg,
      measured_at: input.measured_at,
      note: input.note ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.repo.create(record);
    return this.toDomain(record);
  }

  async update(userId: string, id: string, input: WeightEntryUpdateInputDto): Promise<WeightEntry> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new WeightEntryNotFoundError();
    const record: WeightEntryRecord = {
      ...existing,
      weight_kg: input.weight_kg ?? existing.weight_kg,
      measured_at: input.measured_at ?? existing.measured_at,
      note: input.note !== undefined ? input.note : existing.note,
      updated_at: new Date().toISOString(),
    };
    await this.repo.update(record);
    return this.toDomain(record);
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repo.delete(id, userId))) throw new WeightEntryNotFoundError();
  }
}
