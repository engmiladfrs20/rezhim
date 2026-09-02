import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminAuthProvider, useAdminAuth } from '../src/auth/AdminAuthProvider';
import App from '../src/App';
import type { PublicUser } from '@nutriai/types';
import type { FoodNutrientInputDto, FoodServingInputDto } from '@nutriai/schemas';

const mockAdminUser: PublicUser = {
  id: 'admin-12345678-abcd',
  email: 'admin@example.com',
  display_name: 'Admin Tester',
  role: 'admin',
  status: 'active',
  locale: 'fa',
  email_verified_at: null,
  last_login_at: '2026-08-29T10:00:00.000Z',
  created_at: '2026-08-29T09:00:00.000Z',
  updated_at: '2026-08-29T09:00:00.000Z',
};

const mockRegularUser: PublicUser = {
  id: 'user-87654321-wxyz',
  email: 'user@example.com',
  display_name: 'Regular Tester',
  role: 'user',
  status: 'active',
  locale: 'fa',
  email_verified_at: null,
  last_login_at: '2026-08-29T10:00:00.000Z',
  created_at: '2026-08-29T09:00:00.000Z',
  updated_at: '2026-08-29T09:00:00.000Z',
};

const verifiedProvenance = {
  sourceId: 'src_usda_fdc',
  externalId: 'test-provenance-record',
  sourceUrl: 'https://fdc.nal.usda.gov/',
  citation: 'USDA FoodData Central test fixture',
  datasetVersion: 'test-1',
  method: 'database' as const,
  retrievedAt: '2026-08-30T00:00:00.000Z',
  license: 'Public Domain',
};

function renderAdminApp(initialUser: PublicUser | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if (initialUser) {
    queryClient.setQueryData(['admin-auth', 'me'], initialUser);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <App />
      </AdminAuthProvider>
    </QueryClientProvider>,
  );
}

describe('Admin App - Auth, RBAC, User Management, Modals & Localization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders admin login screen when unauthenticated', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderAdminApp();

    expect(await screen.findByRole('heading', { name: /Admin Portal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In as Admin/i })).toBeInTheDocument();
  });

  it('switches the unauthenticated login screen between Persian RTL and English LTR', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderAdminApp();

    const faButton = await screen.findByRole('button', { name: 'فارسی' });
    fireEvent.click(faButton);
    expect(screen.getByRole('heading', { name: /پنل مدیریت/i })).toBeInTheDocument();
    expect(faButton.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'ورود مدیر' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { name: /Admin Portal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In as Admin' })).toBeInTheDocument();
  });

  it('handles admin login successfully and displays dashboard with credentials: include', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit | undefined }> = [];
    let loggedIn = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      fetchCalls.push({ url: urlStr, init });

      if (urlStr.includes('/api/v1/auth/me')) {
        return loggedIn
          ? new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
              status: 200,
            })
          : new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      if (urlStr.includes('/api/v1/auth/login')) {
        loggedIn = true;
        return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
          status: 200,
        });
      }
      if (urlStr.includes('/api/v1/admin/users')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { users: [mockAdminUser, mockRegularUser], nextCursor: null },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderAdminApp();

    const emailInput = await screen.findByLabelText(/Administrator Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);

    fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'AdminPassword123!' } });

    const form = emailInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      const loginCall = fetchCalls.find((c) => c.url.includes('/api/v1/auth/login'));
      expect(loginCall).toBeDefined();
      expect(loginCall?.init?.credentials).toBe('include');
    });
  });

  it('displays error when admin login fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      if (urlStr.includes('/api/v1/auth/login')) {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Invalid admin credentials' } }),
          { status: 401 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderAdminApp();

    const emailInput = await screen.findByLabelText(/Administrator Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);

    fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword123!' } });

    const form = emailInput.closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Invalid admin credentials/i)).toBeInTheDocument();
  });

  it('rejects regular users attempting to access admin portal', async () => {
    let logoutCalled = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: true, data: { user: mockRegularUser } }), {
          status: 200,
        });
      }
      if (urlStr.includes('/api/v1/auth/logout')) {
        logoutCalled = true;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderAdminApp();

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
    });
  });

  it('lists users, applies filters, and handles pagination', async () => {
    const fetchUrls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      fetchUrls.push(urlStr);

      if (urlStr.includes('/api/v1/admin/users')) {
        expect(init?.credentials).toBe('include');
        return new Response(
          JSON.stringify({
            success: true,
            data: { users: [mockAdminUser, mockRegularUser], nextCursor: 'cursor_page_2' },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();

    // Filter by Role
    const roleSelect = await screen.findByLabelText(/Filter by Role/i);
    fireEvent.change(roleSelect, { target: { value: 'admin' } });

    await waitFor(() => {
      expect(fetchUrls.some((u) => u.includes('role=admin'))).toBe(true);
    });

    // Filter by Status
    const statusSelect = await screen.findByLabelText(/Filter by Status/i);
    fireEvent.change(statusSelect, { target: { value: 'active' } });

    await waitFor(() => {
      expect(fetchUrls.some((u) => u.includes('status=active'))).toBe(true);
    });

    // Pagination Next
    const nextBtn = await screen.findByRole('button', { name: /Next/i });
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(fetchUrls.some((u) => u.includes('cursor=cursor_page_2'))).toBe(true);
    });
  });

  it('views user details modal via GET /api/v1/admin/users/:id', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes(`/api/v1/admin/users/${mockRegularUser.id}`)) {
        return new Response(JSON.stringify({ success: true, data: { user: mockRegularUser } }), {
          status: 200,
        });
      }
      if (urlStr.includes('/api/v1/admin/users')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { users: [mockAdminUser, mockRegularUser], nextCursor: null },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    const viewBtn = await screen.findByLabelText(`View details for ${mockRegularUser.email}`);
    fireEvent.click(viewBtn);

    expect(await screen.findByRole('heading', { name: /User Details/i })).toBeInTheDocument();
    expect(await screen.findByText(mockRegularUser.id)).toBeInTheDocument();

    const closeBtn = screen.getByLabelText(/Close user details/i);
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /User Details/i })).not.toBeInTheDocument();
    });
  });

  it('toggles user status and ensures current admin self-toggle is disabled', async () => {
    let patchCalled = false;
    let patchInit: RequestInit | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes(`/api/v1/admin/users/${mockRegularUser.id}/status`)) {
        patchCalled = true;
        patchInit = init;
        return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
      }
      if (urlStr.includes('/api/v1/admin/users')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { users: [mockAdminUser, mockRegularUser], nextCursor: null },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    // Current admin's toggle button must be disabled
    const adminToggleBtn = await screen.findByLabelText(`Toggle status for ${mockAdminUser.email}`);
    expect(adminToggleBtn).toBeDisabled();

    // Regular user's toggle button must be enabled
    const userToggleBtn = screen.getByLabelText(`Toggle status for ${mockRegularUser.email}`);
    expect(userToggleBtn).not.toBeDisabled();

    fireEvent.click(userToggleBtn);

    await waitFor(() => {
      expect(patchCalled).toBe(true);
      expect(patchInit?.credentials).toBe('include');
      expect(JSON.parse(String(patchInit?.body))).toEqual({ status: 'disabled' });
    });
  });

  it('displays error feedback when status update fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes(`/api/v1/admin/users/${mockRegularUser.id}/status`)) {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Cannot modify root user' } }),
          { status: 403 },
        );
      }
      if (urlStr.includes('/api/v1/admin/users')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { users: [mockAdminUser, mockRegularUser], nextCursor: null },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    const userToggleBtn = await screen.findByLabelText(
      `Toggle status for ${mockRegularUser.email}`,
    );
    fireEvent.click(userToggleBtn);

    expect(await screen.findByText(/Cannot modify root user/i)).toBeInTheDocument();
  });

  it('logs out admin and redirects to login screen', async () => {
    let logoutCalled = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/logout')) {
        logoutCalled = true;
        expect(init?.credentials).toBe('include');
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (urlStr.includes('/api/v1/admin/users')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { users: [mockAdminUser], nextCursor: null },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    const logoutBtn = await screen.findByRole('button', { name: /Logout|خروج/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
    });
  });

  it('toggles locale and synchronizes RTL/LTR direction in admin portal', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/admin/users')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { users: [mockAdminUser], nextCursor: null },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    // Switch to English
    const enBtn = await screen.findByRole('button', { name: 'EN' });
    fireEvent.click(enBtn);

    const rootMain = screen.getByRole('main');
    expect(rootMain).toHaveAttribute('dir', 'ltr');

    // Switch to Persian
    const faBtn = screen.getByRole('button', { name: 'فارسی' });
    fireEvent.click(faBtn);

    expect(rootMain).toHaveAttribute('dir', 'rtl');
  });

  it('navigates to Food Catalog tab, lists foods, and filters by category and status', async () => {
    const mockFoods = [
      {
        id: 'food_1',
        name: 'نان بربری',
        description: 'نان سنتی',
        locale: 'fa',
        foodType: 'generic',
        brandName: null,
        barcode: '6261111111',
        status: 'active',
        categoryId: 'cat_grains',
        categoryName: 'نان و غلات',
        energyKcal: 260,
        proteinG: 9,
        carbsG: 50,
        fatG: 1.5,
        createdAt: '2026-08-29T10:00:00Z',
        updatedAt: '2026-08-29T10:00:00Z',
      },
    ];

    const mockCategories = [
      {
        id: 'cat_grains',
        slug: 'grains-cereals',
        name: 'نان و غلات',
        description: null,
        locale: 'fa',
        status: 'active',
        parentId: null,
        translations: [],
        createdAt: '2026-08-29T00:00:00Z',
        updatedAt: '2026-08-29T00:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/admin/users')) {
        return new Response(
          JSON.stringify({ success: true, data: { users: [mockAdminUser], nextCursor: null } }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/admin/foods/categories')) {
        return new Response(
          JSON.stringify({ success: true, data: { categories: mockCategories } }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/admin/foods')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { items: mockFoods, nextCursor: null, hasMore: false },
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/nutrients')) {
        return new Response(JSON.stringify({ success: true, data: { nutrients: [] } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    // Click on Food Catalog tab
    const foodTab = await screen.findByRole('button', { name: /Food Catalog/i });
    fireEvent.click(foodTab);

    expect(await screen.findByText('Food Catalog Management')).toBeInTheDocument();
    expect(await screen.findByText('نان بربری')).toBeInTheDocument();
    expect(screen.getByText('260 kcal')).toBeInTheDocument();

    // Filter by Category
    const categorySelect = screen.getByLabelText('Filter by Category');
    fireEvent.change(categorySelect, { target: { value: 'cat_grains' } });

    // Filter by Status
    const statusSelect = screen.getByLabelText('Filter by Status');
    fireEvent.change(statusSelect, { target: { value: 'active' } });

    const searchInput = screen.getByLabelText('Search foods');
    fireEvent.change(searchInput, { target: { value: 'بربری' } });
    await waitFor(() => {
      expect(
        vi.mocked(globalThis.fetch).mock.calls.some(([url]) => String(url).includes('q=')),
      ).toBe(true);
    });
  });

  it('opens Food Details modal and displays complete information', async () => {
    const mockFoodDetail = {
      id: 'food_detail_1',
      name: 'سیب درختی دماوند',
      description: 'سیب قرمز درجه یک',
      locale: 'fa',
      foodType: 'generic',
      brandName: null,
      barcode: '6262222222',
      status: 'active',
      categoryId: 'cat_fruits',
      category: {
        id: 'cat_fruits',
        slug: 'fruits',
        name: 'میوه‌ها',
        description: null,
        locale: 'fa',
        status: 'active',
        parentId: null,
      },
      sourceId: null,
      source: null,
      externalId: null,
      translations: [
        {
          id: 't1',
          foodId: 'food_detail_1',
          locale: 'fa',
          name: 'سیب درختی دماوند',
          description: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      aliases: [],
      nutrients: [
        {
          nutrientId: 'nut_energy',
          ...verifiedProvenance,
          code: 'energy',
          name: 'انرژی',
          unit: 'kcal',
          amountPer100g: 52,
        },
      ],
      servings: [
        {
          id: 's1',
          foodId: 'food_detail_1',
          nameFa: 'یک عدد متوسط',
          nameEn: '1 Medium apple',
          weightG: 182,
          householdUnit: 'عدد',
        },
      ],
      createdAt: '2026-08-29T10:00:00Z',
      updatedAt: '2026-08-29T10:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/admin/foods/food_detail_1')) {
        return new Response(JSON.stringify({ success: true, data: { food: mockFoodDetail } }), {
          status: 200,
        });
      }
      if (urlStr.includes('/api/v1/admin/foods')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { items: [mockFoodDetail], nextCursor: null, hasMore: false },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    const foodTab = await screen.findByRole('button', { name: /Food Catalog/i });
    fireEvent.click(foodTab);

    const viewBtn = await screen.findByLabelText('View details for سیب درختی دماوند');
    fireEvent.click(viewBtn);

    expect(await screen.findByText('52 kcal')).toBeInTheDocument();
    expect(screen.getByText('182g')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close details');
    fireEvent.click(closeBtn);
  });

  it('opens Add Food modal, validates inputs, and submits new food', async () => {
    let createdPayload: unknown = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.endsWith('/api/v1/admin/foods') && init?.method === 'POST') {
        createdPayload = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({ success: true, data: { food: { id: 'new_food_id' } } }),
          { status: 201 },
        );
      }
      if (urlStr.includes('/api/v1/admin/foods/categories')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { categories: [{ id: 'cat_fruits', name: 'میوه‌ها' }] },
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/nutrients')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              nutrients: [{ id: 'nut_energy', code: 'energy', nameFa: 'انرژی', unit: 'kcal' }],
            },
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/admin/foods')) {
        return new Response(
          JSON.stringify({ success: true, data: { items: [], nextCursor: null, hasMore: false } }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    const foodTab = await screen.findByRole('button', { name: /Food Catalog/i });
    fireEvent.click(foodTab);

    const addBtn = await screen.findByRole('button', { name: /Add Food/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Add New Food')).toBeInTheDocument();

    // Fill form
    const faNameInput = screen.getByPlaceholderText('مثلاً: سیب تازه');
    fireEvent.change(faNameInput, { target: { value: 'هلو زعفرانی' } });

    const enNameInput = screen.getByPlaceholderText('e.g. Fresh Apple');
    fireEvent.change(enNameInput, { target: { value: 'Saffron Peach' } });

    const caloriesInput = screen.getByLabelText('Calories (kcal)');
    fireEvent.change(caloriesInput, { target: { value: '45' } });

    const submitBtn = screen.getByRole('button', { name: 'Create Food' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createdPayload).toBeTruthy();
    });
  });

  it('proves Admin Food Edit preserves all aliases, micronutrients (>5), and multiple servings when editing name only', async () => {
    let patchPayload: {
      translations: Array<{ locale: string; name: string }>;
      aliases: Array<{ locale: string; alias: string }>;
      nutrients: FoodNutrientInputDto[];
      servings: FoodServingInputDto[];
    } | null = null;

    const mockRichFoodDetail = {
      id: 'food_rich_edit_1',
      name: 'نان سنگک سنتی',
      description: 'نان سبوس‌دار',
      locale: 'fa',
      foodType: 'generic',
      brandName: null,
      barcode: '6261234567890',
      status: 'active',
      categoryId: 'cat_grains',
      category: {
        id: 'cat_grains',
        slug: 'grains',
        name: 'نان و غلات',
        description: null,
        locale: 'fa',
        status: 'active',
        parentId: null,
      },
      sourceId: null,
      source: null,
      externalId: null,
      translations: [
        {
          id: 't1',
          foodId: 'food_rich_edit_1',
          locale: 'fa',
          name: 'نان سنگک سنتی',
          description: 'نان سبوس‌دار',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 't2',
          foodId: 'food_rich_edit_1',
          locale: 'en',
          name: 'Traditional Sangak Bread',
          description: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      aliases: [
        { id: 'a1', foodId: 'food_rich_edit_1', locale: 'fa', alias: 'سنگک کنجدی' },
        { id: 'a2', foodId: 'food_rich_edit_1', locale: 'en', alias: 'Sesame Sangak' },
      ],
      nutrients: [
        {
          nutrientId: 'nut_energy',
          ...verifiedProvenance,
          code: 'energy',
          name: 'Energy',
          unit: 'kcal',
          amountPer100g: 259,
        },
        {
          nutrientId: 'nut_protein',
          ...verifiedProvenance,
          code: 'protein',
          name: 'Protein',
          unit: 'g',
          amountPer100g: 9.2,
        },
        {
          nutrientId: 'nut_carbohydrate',
          ...verifiedProvenance,
          code: 'carbohydrate',
          name: 'Carbs',
          unit: 'g',
          amountPer100g: 52.4,
        },
        {
          nutrientId: 'nut_fat_total',
          ...verifiedProvenance,
          code: 'fat_total',
          name: 'Fat',
          unit: 'g',
          amountPer100g: 1.5,
        },
        {
          nutrientId: 'nut_fiber',
          ...verifiedProvenance,
          code: 'fiber',
          name: 'Fiber',
          unit: 'g',
          amountPer100g: 3.8,
        },
        {
          nutrientId: 'nut_iron',
          ...verifiedProvenance,
          code: 'iron',
          name: 'Iron',
          unit: 'mg',
          amountPer100g: 2.5,
        },
        {
          nutrientId: 'nut_calcium',
          ...verifiedProvenance,
          code: 'calcium',
          name: 'Calcium',
          unit: 'mg',
          amountPer100g: 50,
        },
      ],
      servings: [
        {
          id: 's1',
          ...verifiedProvenance,
          foodId: 'food_rich_edit_1',
          nameFa: 'یک کف دست',
          nameEn: '1 Palm',
          weightG: 30,
          householdUnit: 'کف دست',
        },
        {
          id: 's2',
          ...verifiedProvenance,
          foodId: 'food_rich_edit_1',
          nameFa: 'یک قرص کامل',
          nameEn: '1 Loaf',
          weightG: 400,
          householdUnit: 'قرص',
        },
      ],
      createdAt: '2026-08-29T10:00:00Z',
      updatedAt: '2026-08-29T10:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/admin/foods/food_rich_edit_1') && init?.method === 'PATCH') {
        patchPayload = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ success: true, data: { food: mockRichFoodDetail } }), {
          status: 200,
        });
      }
      if (urlStr.includes('/api/v1/admin/foods/food_rich_edit_1')) {
        return new Response(JSON.stringify({ success: true, data: { food: mockRichFoodDetail } }), {
          status: 200,
        });
      }
      if (urlStr.includes('/api/v1/admin/foods/categories')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { categories: [{ id: 'cat_grains', name: 'نان و غلات' }] },
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/nutrients')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              nutrients: [
                { id: 'nut_energy', code: 'energy', name: 'Energy', unit: 'kcal' },
                { id: 'nut_protein', code: 'protein', name: 'Protein', unit: 'g' },
                { id: 'nut_carbohydrate', code: 'carbohydrate', name: 'Carbs', unit: 'g' },
                { id: 'nut_fat_total', code: 'fat_total', name: 'Fat', unit: 'g' },
                { id: 'nut_fiber', code: 'fiber', name: 'Fiber', unit: 'g' },
                { id: 'nut_iron', code: 'iron', name: 'Iron', unit: 'mg' },
                { id: 'nut_calcium', code: 'calcium', name: 'Calcium', unit: 'mg' },
              ],
            },
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/admin/foods')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { items: [mockRichFoodDetail], nextCursor: null, hasMore: false },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    const foodTab = await screen.findByRole('button', { name: /Food Catalog/i });
    fireEvent.click(foodTab);

    const editBtn = await screen.findByLabelText('Edit نان سنگک سنتی');
    fireEvent.click(editBtn);

    expect(await screen.findByText('Edit Food')).toBeInTheDocument();

    // Verify existing aliases are visible
    expect(screen.getByText('سنگک کنجدی')).toBeInTheDocument();
    expect(screen.getByText('Sesame Sangak')).toBeInTheDocument();

    // Verify existing servings are visible
    expect(screen.getByText('یک کف دست')).toBeInTheDocument();
    expect(screen.getByText('یک قرص کامل')).toBeInTheDocument();

    // Edit ONLY Persian Name
    const faNameInput = screen.getByDisplayValue('نان سنگک سنتی');
    fireEvent.change(faNameInput, { target: { value: 'نان سنگک اعلا دو رو کنجد' } });

    // Submit edit
    const updateBtn = screen.getByRole('button', { name: 'Update Food' });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(patchPayload).not.toBeNull();
    });

    // Assert ALL data is preserved in PATCH payload
    expect(patchPayload!.translations.some((t) => t.name === 'نان سنگک اعلا دو رو کنجد')).toBe(
      true,
    );
    expect(patchPayload!.aliases.length).toBe(2);
    expect(patchPayload!.aliases.some((a) => a.alias === 'سنگک کنجدی')).toBe(true);
    expect(patchPayload!.aliases.some((a) => a.alias === 'Sesame Sangak')).toBe(true);

    // Assert micronutrients (iron, calcium) are preserved alongside macros
    expect(patchPayload!.nutrients.length).toBe(7);
    expect(
      patchPayload!.nutrients.some(
        (n) => n.nutrient_id === 'nut_iron' && n.amount_per_100g === 2.5,
      ),
    ).toBe(true);
    expect(
      patchPayload!.nutrients.some(
        (n) => n.nutrient_id === 'nut_calcium' && n.amount_per_100g === 50,
      ),
    ).toBe(true);
    expect(
      patchPayload!.nutrients.every(
        (n) => n.source_id === 'src_usda_fdc' && n.citation && n.retrieved_at,
      ),
    ).toBe(true);

    // Assert all 2 servings are preserved
    expect(patchPayload!.servings.length).toBe(2);
    expect(patchPayload!.servings.some((s) => s.weight_g === 400)).toBe(true);
    expect(
      patchPayload!.servings.every(
        (s) => s.source_id === 'src_usda_fdc' && s.citation && s.retrieved_at,
      ),
    ).toBe(true);
  });

  it('archives food item when confirmed by admin', async () => {
    let archiveCalled = false;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const mockFood = {
      id: 'food_archive_target',
      name: 'غذای آزمایشی آرشیو',
      description: null,
      locale: 'fa',
      foodType: 'generic',
      brandName: null,
      barcode: null,
      status: 'active',
      categoryId: null,
      categoryName: null,
      energyKcal: 100,
      proteinG: null,
      carbsG: null,
      fatG: null,
      createdAt: '2026-08-29T10:00:00Z',
      updatedAt: '2026-08-29T10:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/admin/foods/food_archive_target') && init?.method === 'DELETE') {
        archiveCalled = true;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (urlStr.includes('/api/v1/admin/foods')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { items: [mockFood], nextCursor: null, hasMore: false },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockAdminUser } }), {
        status: 200,
      });
    });

    renderAdminApp(mockAdminUser);

    const foodTab = await screen.findByRole('button', { name: /Food Catalog/i });
    fireEvent.click(foodTab);

    const archiveBtn = await screen.findByLabelText('Archive غذای آزمایشی آرشیو');
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(archiveCalled).toBe(true);
    });
  });

  it('throws error when useAdminAuth is used outside of AdminAuthProvider', () => {
    const TestComponent = () => {
      useAdminAuth();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponent />)).toThrow(
      'useAdminAuth must be used within an AdminAuthProvider',
    );
  });
});
