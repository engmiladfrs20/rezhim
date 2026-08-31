import type { D1Database } from '@cloudflare/workers-types';
import type {
  ShoppingListCreateInputDto,
  ShoppingListQueryDto,
  ShoppingListUpdateInputDto,
} from '@nutriai/schemas';
import type { ShoppingListItem } from '@nutriai/types';
import { FoodRepository } from '../db/food.repository';
import { ShoppingListRepository } from '../db/shopping-list.repository';
import type { ShoppingListItemRecord } from '../db/models';
import { InventoryValidationError, ShoppingListItemNotFoundError } from '../db/errors';

export class ShoppingListService {
  private readonly listRepo: ShoppingListRepository;
  private readonly foodRepo: FoodRepository;

  constructor(db: D1Database) {
    this.listRepo = new ShoppingListRepository(db);
    this.foodRepo = new FoodRepository(db);
  }

  private toItem(record: ShoppingListItemRecord): ShoppingListItem {
    return {
      id: record.id,
      userId: record.user_id,
      foodId: record.food_id,
      requiredGrams: Number(record.required_grams),
      purchasedGrams: Number(record.purchased_grams),
      status: record.status,
      note: record.note,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private async assertActiveFood(foodId: string): Promise<void> {
    const food = await this.foodRepo.findById(foodId);
    if (!food || food.status !== 'active') {
      throw new InventoryValidationError(
        'Only active food items can be added to a shopping list.',
        'food_id',
      );
    }
  }

  async create(userId: string, dto: ShoppingListCreateInputDto): Promise<ShoppingListItem> {
    await this.assertActiveFood(dto.food_id);
    const now = new Date().toISOString();
    const record: ShoppingListItemRecord = {
      id: `shopping_${crypto.randomUUID()}`,
      user_id: userId,
      food_id: dto.food_id,
      required_grams: dto.required_grams,
      purchased_grams: dto.purchased_grams,
      status: dto.status,
      note: dto.note ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.listRepo.create(record);
    return this.toItem(record);
  }

  async list(userId: string, query: ShoppingListQueryDto): Promise<ShoppingListItem[]> {
    const records = await this.listRepo.listByUser(userId, query.status);
    return records.map((record) => this.toItem(record));
  }

  async update(
    userId: string,
    id: string,
    dto: ShoppingListUpdateInputDto,
  ): Promise<ShoppingListItem> {
    const existing = await this.listRepo.findByIdForUser(id, userId);
    if (!existing) throw new ShoppingListItemNotFoundError();
    const foodId = dto.food_id ?? existing.food_id;
    if (dto.food_id !== undefined) await this.assertActiveFood(foodId);
    const record: ShoppingListItemRecord = {
      ...existing,
      food_id: foodId,
      required_grams: dto.required_grams ?? existing.required_grams,
      purchased_grams: dto.purchased_grams ?? existing.purchased_grams,
      status: dto.status ?? existing.status,
      note: dto.note !== undefined ? dto.note : existing.note,
      updated_at: new Date().toISOString(),
    };
    await this.listRepo.update(record);
    return this.toItem(record);
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.listRepo.delete(id, userId))) throw new ShoppingListItemNotFoundError();
  }
}
