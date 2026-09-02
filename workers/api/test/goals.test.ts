import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';

const testEnv = env as ProvidedEnv;

describe('User nutrition goal persistence', () => {
  beforeEach(async () => {
    await testEnv.DB!.prepare('DELETE FROM user_nutrition_goals').run();
    await testEnv.DB!.prepare('DELETE FROM auth_sessions').run();
    await testEnv.DB!.prepare('DELETE FROM auth_login_attempts').run();
    await testEnv.DB!.prepare('DELETE FROM users').run();
  });

  it('requires authentication and round-trips a goal with preferences', async () => {
    const unauthenticated = await app.request('/api/v1/users/me/goals', {}, testEnv);
    expect(unauthenticated.status).toBe(401);

    await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'goal-test@example.com',
          password: 'GoalPassword123!',
          display_name: 'Goal Test',
        }),
      },
      testEnv,
    );
    const login = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'goal-test@example.com', password: 'GoalPassword123!' }),
      },
      testEnv,
    );
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('Set-Cookie');
    expect(setCookie).toBeTruthy();
    const cookie = setCookie!.split(';', 1)[0]!;
    const goal = {
      gender: 'female',
      age: 31,
      heightCm: 166,
      weightKg: 68,
      activityLevel: 'moderately_active',
      dietGoal: 'weight_loss_mild',
      formula: 'mifflin_st_jeor',
      lifeStage: 'adult_non_pregnant_non_lactating',
      mealsPerDay: 4,
      dietaryPreferences: ['غذای ایرانی'],
      allergies: ['بادام زمینی'],
    };
    const saved = await app.request(
      '/api/v1/users/me/goals',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'http://localhost' },
        body: JSON.stringify(goal),
      },
      testEnv,
    );
    expect(saved.status).toBe(200);
    const savedBody = await saved.json<{
      data: { goal: { weightKg: number; dietaryPreferences: string[] } };
    }>();
    expect(savedBody.data.goal.weightKg).toBe(68);
    expect(savedBody.data.goal.dietaryPreferences).toEqual(['غذای ایرانی']);

    const fetched = await app.request(
      '/api/v1/users/me/goals',
      { headers: { Cookie: cookie } },
      testEnv,
    );
    expect(fetched.status).toBe(200);
    const fetchedBody = await fetched.json<{ data: { goal: { allergies: string[] } } }>();
    expect(fetchedBody.data.goal.allergies).toEqual(['بادام زمینی']);
  }, 30000);
});
