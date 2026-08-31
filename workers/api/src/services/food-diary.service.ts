import type { CreateDiaryEntryDto, DiaryListQueryDto, UpdateDiaryEntryDto } from '@nutriai/schemas';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  DailyDiarySummary,
  FoodDiaryEntry,
  FoodDiaryEntryWithNutrition,
  FoodPortionNutrition,
} from '@nutriai/types';
import { NutritionValidationError } from '@nutriai/nutrition';
import { FoodDiaryRepository } from '../db/food-diary.repository';
import type { FoodDiaryEntryRecord } from '../db/models';
import { DiaryEntryNotFoundError } from '../db/errors';
import { NutritionService } from './nutrition.service';

export class FoodDiaryService {
  private readonly diaryRepo: FoodDiaryRepository;
  private readonly nutritionService: NutritionService;

  constructor(db: D1Database) {
    this.diaryRepo = new FoodDiaryRepository(db);
    this.nutritionService = new NutritionService(db);
  }

  private toNutritionInput(entry: FoodDiaryEntryRecord) {
    return {
      foodId: entry.food_id,
      grams: entry.grams ?? undefined,
      servingId: entry.serving_id ?? undefined,
      quantity: entry.grams === null ? entry.quantity : undefined,
    };
  }

  private toEntry(
    record: FoodDiaryEntryRecord,
    nutrition: FoodPortionNutrition,
  ): FoodDiaryEntryWithNutrition {
    const entry: FoodDiaryEntry = {
      id: record.id,
      userId: record.user_id,
      foodId: record.food_id,
      servingId: record.serving_id,
      grams: record.grams === null ? null : Number(record.grams),
      quantity: Number(record.quantity),
      mealType: record.meal_type,
      consumedAt: record.consumed_at,
      note: record.note,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
    return { ...entry, nutrition };
  }

  private async calculateEntryNutrition(
    entry: FoodDiaryEntryRecord,
  ): Promise<FoodPortionNutrition> {
    const result = await this.nutritionService.aggregateNutrition([this.toNutritionInput(entry)]);
    const nutrition = result.items[0];
    if (!nutrition) {
      throw new NutritionValidationError(
        'Diary entry nutrition could not be calculated.',
        'foodId',
      );
    }
    return nutrition;
  }

  async create(userId: string, dto: CreateDiaryEntryDto): Promise<FoodDiaryEntryWithNutrition> {
    const now = new Date().toISOString();
    const entry: FoodDiaryEntryRecord = {
      id: `diary_${crypto.randomUUID()}`,
      user_id: userId,
      food_id: dto.food_id,
      serving_id: dto.serving_id ?? null,
      grams: dto.grams ?? null,
      quantity: dto.quantity,
      meal_type: dto.meal_type,
      consumed_at: dto.consumed_at ?? now,
      note: dto.note ?? null,
      created_at: now,
      updated_at: now,
    };

    const nutrition = await this.calculateEntryNutrition(entry);
    await this.diaryRepo.create(entry);
    return this.toEntry(entry, nutrition);
  }

  async list(userId: string, query: DiaryListQueryDto): Promise<DailyDiarySummary> {
    const records = await this.diaryRepo.listByUserAndDate(userId, query.date);
    const nutritionInputs = records.map((entry) => this.toNutritionInput(entry));
    const aggregate = await this.nutritionService.aggregateNutrition(nutritionInputs);
    const entries = records.map((record, index) => {
      const nutrition = aggregate.items[index];
      if (!nutrition) {
        throw new NutritionValidationError(
          'Diary entry nutrition could not be calculated.',
          'foodId',
        );
      }
      return this.toEntry(record, nutrition);
    });
    return { date: query.date, entries, nutrition: aggregate };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDiaryEntryDto,
  ): Promise<FoodDiaryEntryWithNutrition> {
    const existing = await this.diaryRepo.findByIdForUser(id, userId);
    if (!existing) throw new DiaryEntryNotFoundError();

    const entry: FoodDiaryEntryRecord = {
      ...existing,
      food_id: existing.food_id,
      serving_id: dto.serving_id !== undefined ? dto.serving_id : existing.serving_id,
      grams: dto.grams !== undefined ? dto.grams : existing.grams,
      quantity: dto.quantity ?? existing.quantity,
      meal_type: dto.meal_type ?? existing.meal_type,
      consumed_at: dto.consumed_at ?? existing.consumed_at,
      note: dto.note !== undefined ? dto.note : existing.note,
      updated_at: new Date().toISOString(),
    };
    if (entry.grams === null && entry.serving_id === null) {
      throw new NutritionValidationError('Diary entry must specify grams or serving_id.', 'grams');
    }
    if (entry.grams !== null && entry.serving_id !== null) {
      throw new NutritionValidationError(
        'Diary entry cannot specify both grams and serving_id.',
        'grams',
      );
    }

    const nutrition = await this.calculateEntryNutrition(entry);
    await this.diaryRepo.update(entry);
    return this.toEntry(entry, nutrition);
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.diaryRepo.delete(id, userId);
    if (!deleted) throw new DiaryEntryNotFoundError();
  }
}
