import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserDashboard } from '../src/dashboard/UserDashboard';
import type { PublicUser } from '@nutriai/types';

const user: PublicUser = {
  id: 'dashboard-user',
  email: 'dashboard@example.com',
  display_name: 'کاربر تست',
  role: 'user',
  status: 'active',
  locale: 'fa',
  email_verified_at: null,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const foods = [
  ['food-1', 'عدس پخته'],
  ['food-2', 'نخود پخته'],
  ['food-3', 'ماست پرچرب'],
  ['food-4', 'گردو'],
].map(([id, name], index) => ({
  id,
  name,
  description: null,
  locale: 'fa' as const,
  resolvedLocale: 'fa' as const,
  foodType: 'generic' as const,
  brandName: null,
  barcode: null,
  status: 'active' as const,
  categoryId: null,
  categoryName: null,
  energyKcal: 100 + index * 20,
  proteinG: 8,
  carbsG: 18,
  fatG: 3,
  createdAt: '',
  updatedAt: '',
}));

const targets = {
  bmr: 1400,
  tdee: 2000,
  targetCalories: 1800,
  calorieDelta: -200,
  macronutrients: {
    proteinGrams: 120,
    proteinCalories: 480,
    proteinPercentage: 27,
    fatGrams: 60,
    fatCalories: 540,
    fatPercentage: 30,
    carbsGrams: 195,
    carbsCalories: 780,
    carbsPercentage: 43,
  },
  micronutrients: {
    recommendedWaterMl: 2200,
    minimumFiberGrams: 25,
    maximumSodiumMg: 2300,
    recommendedCalciumMg: 1000,
    recommendedIronMg: 18,
    recommendedPotassiumMg: 3400,
  },
};

const plan = {
  algorithmVersion: 'test',
  requestedLocale: 'fa' as const,
  targetCaloriesPerDay: 1800,
  candidateFoodIds: foods.map((food) => food.id),
  days: [
    {
      day: 1,
      nutrition: {
        totalPortionGrams: 400,
        totalEnergyKcal: 1800,
        totalProteinGrams: 120,
        totalCarbsGrams: 195,
        totalFatGrams: 60,
        nutrients: [],
        items: [],
      },
      meals: ['breakfast', 'lunch', 'dinner', 'snack'].map((mealType, index) => ({
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        targetCalories: [450, 630, 540, 180][index],
        nutrition: {
          totalPortionGrams: 100,
          totalEnergyKcal: [450, 630, 540, 180][index],
          totalProteinGrams: 20,
          totalCarbsGrams: 30,
          totalFatGrams: 10,
          nutrients: [],
          items: [
            {
              foodId: foods[index]!.id,
              foodNameFa: foods[index]!.name,
              foodNameEn: foods[index]!.name,
              portionGrams: 100,
              nutrients: [],
              energyKcal: 100,
              proteinGrams: 8,
              carbsGrams: 18,
              fatGrams: 3,
            },
          ],
        },
      })),
    },
  ],
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UserDashboard user={user} locale="fa" onOpenSettings={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('UserDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/foods'))
        return new Response(
          JSON.stringify({
            success: true,
            data: { items: foods, nextCursor: null, hasMore: false },
          }),
          { status: 200 },
        );
      if (url.includes('/api/v1/nutrition/targets'))
        return new Response(JSON.stringify({ success: true, data: targets }), { status: 200 });
      if (url.includes('/api/v1/meal-plans/generate'))
        return new Response(JSON.stringify({ success: true, data: plan }), { status: 200 });
      if (url.includes('/api/v1/diary') && init?.method === 'POST')
        return new Response(JSON.stringify({ success: true, data: { entry: {} } }), {
          status: 201,
        });
      if (url.includes('/api/v1/diary'))
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              date: '2026-01-01',
              entries: [],
              nutrition: {
                totalPortionGrams: 0,
                totalEnergyKcal: 0,
                totalProteinGrams: 0,
                totalCarbsGrams: 0,
                totalFatGrams: 0,
                nutrients: [],
                items: [],
              },
            },
          }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
    });
  });

  it('walks through onboarding, builds a plan, searches food, and logs a portion', async () => {
    renderDashboard();
    expect(screen.getByText('برنامه‌ای که برای تو ساخته می‌شود')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ادامه' }));
    fireEvent.click(screen.getByRole('button', { name: /عضله‌سازی پروتئین/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ادامه' }));
    fireEvent.change(screen.getByLabelText('تعداد وعده در روز'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت برنامه من' }));
    expect(await screen.findByText('برنامهٔ اختصاصی تو آماده شد ✨')).toBeInTheDocument();
    expect(screen.getByText('وعده‌هایت آماده‌اند')).toBeInTheDocument();
    const search = screen.getByPlaceholderText(/عدس/);
    fireEvent.change(search, { target: { value: 'عدس' } });
    expect(await screen.findByRole('button', { name: /عدس پخته/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /عدس پخته/ }));
    fireEvent.change(screen.getByLabelText('مقدار مصرف (گرم)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت در دفترچه' }));
    await waitFor(() =>
      expect(screen.getByText('به دفترچهٔ غذایی امروز اضافه شد.')).toBeInTheDocument(),
    );
  });

  it('restores a saved goal and exposes daily macro guidance and settings action', async () => {
    localStorage.setItem(
      `nutriai.goal.${user.id}`,
      JSON.stringify({ ...defaultGoalForTest(), dietGoal: 'maintenance' }),
    );
    const onOpenSettings = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <UserDashboard user={user} locale="fa" onOpenSettings={onOpenSettings} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('تعادل روزانه')).toBeInTheDocument();
    expect(screen.getByText('حفظ وزن فعلی')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تنظیمات حساب و زبان' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});

function defaultGoalForTest() {
  return {
    gender: 'female',
    age: '30',
    heightCm: '165',
    weightKg: '70',
    activityLevel: 'moderately_active',
    dietGoal: 'weight_loss_mild',
    formula: 'mifflin_st_jeor',
    mealsPerDay: '4',
    dietaryPreferences: '',
    allergies: '',
  };
}
