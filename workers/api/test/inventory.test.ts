import { beforeEach, describe, expect, it } from 'vitest';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import { app } from '../src/app';
import './apply-migrations';
import type { ApiResponse, PantryItem, ShoppingListItem } from '@nutriai/types';

const testEnv = env as ProvidedEnv;

describe('Phase 18 — pantry, fridge, and shopping list ownership', () => {
  let token = '';
  const foodId = 'inventory_food';

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM pantry_items').run();
    await db.prepare('DELETE FROM shopping_list_items').run();
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();
    await db.prepare('DELETE FROM foods WHERE id = ?').bind(foodId).run();
    await db
      .prepare(
        `INSERT INTO foods (id, category_id, food_type, brand_name, barcode, status, source_id, external_id, created_at, updated_at)
         VALUES (?, NULL, 'generic', NULL, NULL, 'active', NULL, NULL, ?, ?)`,
      )
      .bind(foodId, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
      .run();

    const email = `inventory_${crypto.randomUUID()}@nutriai.persia`;
    const register = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'InventoryPassword123!',
          display_name: 'Inventory User',
        }),
      },
      testEnv,
    );
    expect(register.status).toBe(201);
    const login = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'InventoryPassword123!' }),
      },
      testEnv,
    );
    expect(login.status).toBe(200);
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;
  });

  it('requires authentication for inventory endpoints', async () => {
    expect((await app.request('/api/v1/pantry', {}, testEnv)).status).toBe(401);
    expect((await app.request('/api/v1/shopping-list', {}, testEnv)).status).toBe(401);
  });

  it('creates, filters, updates, and deletes pantry items', async () => {
    const create = await app.request(
      '/api/v1/pantry',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          food_id: foodId,
          location: 'fridge',
          quantity_grams: 500,
          expires_at: '2026-09-15T00:00:00.000Z',
          note: 'fresh',
        }),
      },
      testEnv,
    );
    expect(create.status).toBe(201);
    const item = ((await create.json()) as ApiResponse<{ item: PantryItem }>).data.item;
    expect(item.location).toBe('fridge');
    expect(item.quantityGrams).toBe(500);

    const filtered = await app.request(
      '/api/v1/pantry?location=fridge',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv,
    );
    expect(
      ((await filtered.json()) as ApiResponse<{ items: PantryItem[] }>).data.items,
    ).toHaveLength(1);

    const update = await app.request(
      `/api/v1/pantry/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity_grams: 250, location: 'freezer', note: null }),
      },
      testEnv,
    );
    expect(update.status).toBe(200);
    expect(
      ((await update.json()) as ApiResponse<{ item: PantryItem }>).data.item.quantityGrams,
    ).toBe(250);

    expect(
      (
        await app.request(
          `/api/v1/pantry/${item.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          },
          testEnv,
        )
      ).status,
    ).toBe(200);
    const after = await app.request(
      '/api/v1/pantry',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(((await after.json()) as ApiResponse<{ items: PantryItem[] }>).data.items).toHaveLength(
      0,
    );
  });

  it('rejects missing or inactive foods and malformed updates', async () => {
    const missing = await app.request(
      '/api/v1/pantry',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ food_id: 'missing_food', quantity_grams: 100 }),
      },
      testEnv,
    );
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );

    const invalid = await app.request(
      '/api/v1/pantry',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ food_id: foodId, quantity_grams: -1 }),
      },
      testEnv,
    );
    expect(invalid.status).toBe(400);

    const update = await app.request(
      '/api/v1/pantry/pantry_missing',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      },
      testEnv,
    );
    expect(update.status).toBe(400);
  });

  it('creates, filters, updates, and deletes shopping-list items', async () => {
    const create = await app.request(
      '/api/v1/shopping-list',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          food_id: foodId,
          required_grams: 1000,
          purchased_grams: 200,
          note: 'weekly',
        }),
      },
      testEnv,
    );
    expect(create.status).toBe(201);
    const item = ((await create.json()) as ApiResponse<{ item: ShoppingListItem }>).data.item;
    expect(item.status).toBe('planned');
    expect(item.purchasedGrams).toBe(200);

    const planned = await app.request(
      '/api/v1/shopping-list?status=planned',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv,
    );
    expect(
      ((await planned.json()) as ApiResponse<{ items: ShoppingListItem[] }>).data.items,
    ).toHaveLength(1);

    const update = await app.request(
      `/api/v1/shopping-list/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purchased_grams: 1000, status: 'purchased' }),
      },
      testEnv,
    );
    expect(update.status).toBe(200);
    expect(
      ((await update.json()) as ApiResponse<{ item: ShoppingListItem }>).data.item.status,
    ).toBe('purchased');

    const purchased = await app.request(
      '/api/v1/shopping-list?status=purchased',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv,
    );
    expect(
      ((await purchased.json()) as ApiResponse<{ items: ShoppingListItem[] }>).data.items,
    ).toHaveLength(1);
    expect(
      (
        await app.request(
          `/api/v1/shopping-list/${item.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          },
          testEnv,
        )
      ).status,
    ).toBe(200);
  });

  it('returns stable not-found responses and isolates user ownership', async () => {
    const create = await app.request(
      '/api/v1/shopping-list',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ food_id: foodId, required_grams: 300 }),
      },
      testEnv,
    );
    const ownItem = ((await create.json()) as ApiResponse<{ item: ShoppingListItem }>).data.item;

    const otherEmail = `inventory_other_${crypto.randomUUID()}@nutriai.persia`;
    const register = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otherEmail,
          password: 'InventoryOtherPassword123!',
          display_name: 'Other',
        }),
      },
      testEnv,
    );
    expect(register.status).toBe(201);
    const login = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otherEmail, password: 'InventoryOtherPassword123!' }),
      },
      testEnv,
    );
    const otherToken = ((await login.json()) as ApiResponse<{ token: string }>).data.token;
    const forbidden = await app.request(
      `/api/v1/shopping-list/${ownItem.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({ note: 'cross-user' }),
      },
      testEnv,
    );
    expect(forbidden.status).toBe(404);

    const missing = await app.request(
      '/api/v1/shopping-list/no-such-item',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv,
    );
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe(
      'SHOPPING_LIST_ITEM_NOT_FOUND',
    );
  });
});
