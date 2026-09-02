import type { D1Database } from '@cloudflare/workers-types';
import type { UserNutritionGoalDto } from '@nutriai/schemas';
import type { UserNutritionGoal } from '@nutriai/types';
import type { UserNutritionGoalRecord } from './models';
import { DatabaseError } from './errors';

function decodeList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function toDomain(record: UserNutritionGoalRecord): UserNutritionGoal {
  return {
    userId: record.user_id,
    gender: record.gender,
    age: record.age,
    heightCm: record.height_cm,
    weightKg: record.weight_kg,
    bodyFatPercentage: record.body_fat_percentage ?? undefined,
    lifeStage: record.life_stage,
    activityLevel: record.activity_level,
    dietGoal: record.diet_goal,
    formula: record.formula,
    mealsPerDay: record.meals_per_day,
    dietaryPreferences: decodeList(record.dietary_preferences),
    allergies: decodeList(record.allergies),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export class GoalRepository {
  constructor(private readonly db?: D1Database | undefined) {}

  private getDb(): D1Database {
    if (!this.db)
      throw new DatabaseError('Database binding (DB) is missing in the environment scope.');
    return this.db;
  }

  async findByUserId(userId: string): Promise<UserNutritionGoal | null> {
    try {
      const record = await this.getDb()
        .prepare('SELECT * FROM user_nutrition_goals WHERE user_id = ?')
        .bind(userId)
        .first<UserNutritionGoalRecord>();
      return record ? toDomain(record) : null;
    } catch {
      throw new DatabaseError('Failed to fetch nutrition goal');
    }
  }

  async upsert(
    userId: string,
    goal: UserNutritionGoalDto,
    timestamp: string,
  ): Promise<UserNutritionGoal> {
    try {
      await this.getDb()
        .prepare(
          `
        INSERT INTO user_nutrition_goals (
          user_id, gender, age, height_cm, weight_kg, body_fat_percentage, life_stage,
          activity_level, diet_goal, formula, meals_per_day, dietary_preferences, allergies,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          gender = excluded.gender, age = excluded.age, height_cm = excluded.height_cm,
          weight_kg = excluded.weight_kg, body_fat_percentage = excluded.body_fat_percentage,
          life_stage = excluded.life_stage, activity_level = excluded.activity_level,
          diet_goal = excluded.diet_goal, formula = excluded.formula,
          meals_per_day = excluded.meals_per_day, dietary_preferences = excluded.dietary_preferences,
          allergies = excluded.allergies, updated_at = excluded.updated_at
      `,
        )
        .bind(
          userId,
          goal.gender,
          goal.age,
          goal.heightCm,
          goal.weightKg,
          goal.bodyFatPercentage ?? null,
          goal.lifeStage,
          goal.activityLevel,
          goal.dietGoal,
          goal.formula,
          goal.mealsPerDay,
          JSON.stringify(goal.dietaryPreferences),
          JSON.stringify(goal.allergies),
          timestamp,
          timestamp,
        )
        .run();
      const saved = await this.findByUserId(userId);
      if (!saved) throw new DatabaseError('Failed to persist nutrition goal');
      return saved;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError('Failed to persist nutrition goal');
    }
  }
}
