import type { D1Database } from '@cloudflare/workers-types';
import type {
  PantryCreateInputDto,
  PantryListQueryDto,
  PantryUpdateInputDto,
} from '@nutriai/schemas';
import type { PantryItem } from '@nutriai/types';
import { FoodRepository } from '../db/food.repository';
import { PantryRepository } from '../db/pantry.repository';
import type { PantryItemRecord } from '../db/models';
import { InventoryValidationError, PantryItemNotFoundError } from '../db/errors';

export class PantryService {
  private readonly pantryRepo: PantryRepository;
  private readonly foodRepo: FoodRepository;

  constructor(db: D1Database) {
    this.pantryRepo = new PantryRepository(db);
    this.foodRepo = new FoodRepository(db);
  }

  private toItem(record: PantryItemRecord): PantryItem {
    return {
      id: record.id,
      userId: record.user_id,
      foodId: record.food_id,
      location: record.location,
      quantityGrams: Number(record.quantity_grams),
      expiresAt: record.expires_at,
      note: record.note,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private async assertActiveFood(foodId: string): Promise<void> {
    const food = await this.foodRepo.findById(foodId);
    if (!food || food.status !== 'active') {
      throw new InventoryValidationError(
        'Only active food items can be added to inventory.',
        'food_id',
      );
    }
  }

  async create(userId: string, dto: PantryCreateInputDto): Promise<PantryItem> {
    await this.assertActiveFood(dto.food_id);
    const now = new Date().toISOString();
    const record: PantryItemRecord = {
      id: `pantry_${crypto.randomUUID()}`,
      user_id: userId,
      food_id: dto.food_id,
      location: dto.location,
      quantity_grams: dto.quantity_grams,
      expires_at: dto.expires_at ?? null,
      note: dto.note ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.pantryRepo.create(record);
    return this.toItem(record);
  }

  async list(userId: string, query: PantryListQueryDto): Promise<PantryItem[]> {
    const records = await this.pantryRepo.listByUser(userId, query.location);
    return records.map((record) => this.toItem(record));
  }

  async update(userId: string, id: string, dto: PantryUpdateInputDto): Promise<PantryItem> {
    const existing = await this.pantryRepo.findByIdForUser(id, userId);
    if (!existing) throw new PantryItemNotFoundError();
    const foodId = dto.food_id ?? existing.food_id;
    if (dto.food_id !== undefined) await this.assertActiveFood(foodId);
    const record: PantryItemRecord = {
      ...existing,
      food_id: foodId,
      location: dto.location ?? existing.location,
      quantity_grams: dto.quantity_grams ?? existing.quantity_grams,
      expires_at: dto.expires_at !== undefined ? dto.expires_at : existing.expires_at,
      note: dto.note !== undefined ? dto.note : existing.note,
      updated_at: new Date().toISOString(),
    };
    await this.pantryRepo.update(record);
    return this.toItem(record);
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.pantryRepo.delete(id, userId))) throw new PantryItemNotFoundError();
  }
}
