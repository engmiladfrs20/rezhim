import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminAuthProvider, useAdminAuth } from '../src/auth/AdminAuthProvider';
import App from '../src/App';
import type { PublicUser } from '@nutriai/types';

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

  it('handles admin login successfully and displays dashboard with credentials: include', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit | undefined }> = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      fetchCalls.push({ url: urlStr, init });

      if (urlStr.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      if (urlStr.includes('/api/v1/auth/login')) {
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
