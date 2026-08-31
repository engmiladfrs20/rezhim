import type { D1Database } from '@cloudflare/workers-types';
import type { SubscriptionStatus, SubscriptionPlan, UserSubscription } from '@nutriai/types';
import { DatabaseError } from './errors';

interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: number;
}

export class SubscriptionRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserId(userId: string): Promise<UserSubscription | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, user_id, plan, status, current_period_end, cancel_at_period_end
           FROM user_subscriptions WHERE user_id = ?`,
        )
        .bind(userId)
        .first<SubscriptionRecord>();
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        plan: row.plan,
        status: row.status,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      };
    } catch {
      throw new DatabaseError('Failed to read subscription.');
    }
  }
}
