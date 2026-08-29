import { useState } from 'react';
import type { FC } from 'react';
import { useAdminAuth } from './auth/AdminAuthProvider';
import { AdminLoginScreen } from './auth/AdminLoginScreen';
import { i18n, type SupportedLocale, type Direction } from '@nutriai/localization';
import { Shield, Users, Power, PowerOff, Eye, X, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, ApiResponse } from '@nutriai/types';
import { FoodCatalogManager } from './foods/FoodCatalogManager';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface UserDetailModalProps {
  userId: string;
  onClose: () => void;
}

const UserDetailModal: FC<UserDetailModalProps> = ({ userId, onClose }) => {
  const { data, isLoading, error } = useQuery<ApiResponse<{ user: PublicUser }>>({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/admin/users/${userId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to load user details');
      }
      return res.json() as Promise<ApiResponse<{ user: PublicUser }>>;
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6 text-slate-100">
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            User Details
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close user details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="text-center py-6 text-slate-400">Loading user details...</div>
        )}
        {error && (
          <div className="text-center py-6 text-red-400">
            {error instanceof Error ? error.message : 'Error loading user details'}
          </div>
        )}

        {data?.data?.user && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">User ID</span>
              <span className="col-span-2 font-mono text-xs text-slate-200">
                {data.data.user.id}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">Email</span>
              <span className="col-span-2 text-slate-200">{data.data.user.email}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">Display Name</span>
              <span className="col-span-2 text-slate-200">{data.data.user.display_name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">Role</span>
              <span className="col-span-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    data.data.user.role === 'admin'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {data.data.user.role}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">Status</span>
              <span className="col-span-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    data.data.user.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {data.data.user.status}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">Locale</span>
              <span className="col-span-2 text-slate-200">{data.data.user.locale}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">Created At</span>
              <span className="col-span-2 text-slate-200">{data.data.user.created_at}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-700/50">
              <span className="text-slate-400 font-medium">Last Login</span>
              <span className="col-span-2 text-slate-200">
                {data.data.user.last_login_at || 'Never'}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminUserList: FC<{ currentUser: PublicUser }> = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string>('');

  const { data, isLoading, error } = useQuery<
    ApiResponse<{ users: PublicUser[]; nextCursor?: string | null }>
  >({
    queryKey: ['admin-users', cursor, filterRole, filterStatus],
    queryFn: async () => {
      let url = `${API_URL}/api/v1/admin/users?limit=10`;
      if (cursor) url += `&cursor=${cursor}`;
      if (filterRole) url += `&role=${filterRole}`;
      if (filterStatus) url += `&status=${filterStatus}`;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json() as Promise<
        ApiResponse<{ users: PublicUser[]; nextCursor?: string | null }>
      >;
    },
  });

  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: 'active' | 'disabled' }) => {
      setStatusError('');
      const res = await fetch(`${API_URL}/api/v1/admin/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message || 'Status update failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: unknown) => {
      setStatusError(err instanceof Error ? err.message : 'Status update failed');
    },
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading users...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error loading users.</div>;

  const users = data?.data?.users || [];
  const nextCursor = data?.data?.nextCursor;

  return (
    <div className="w-full bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col gap-6">
      {statusError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-lg border border-slate-800">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" /> User Management
        </h2>
        <div className="flex gap-4">
          <select
            aria-label="Filter by Role"
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setCursor(null);
              setHistory([]);
            }}
            className="bg-slate-800 border-slate-700 text-sm rounded-lg p-2 text-slate-200"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <select
            aria-label="Filter by Status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCursor(null);
              setHistory([]);
            }}
            className="bg-slate-800 border-slate-700 text-sm rounded-lg p-2 text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">ID</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: PublicUser) => {
              const isSelf = u.id === currentUser.id;
              return (
                <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-mono text-xs">{u.id.substring(0, 8)}</td>
                  <td className="px-4 py-3 truncate max-w-[200px]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        u.role === 'admin'
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        u.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedUserId(u.id)}
                      title="View Details"
                      aria-label={`View details for ${u.email}`}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        toggleStatusMut.mutate({
                          id: u.id,
                          newStatus: u.status === 'active' ? 'disabled' : 'active',
                        })
                      }
                      disabled={isSelf || toggleStatusMut.isPending}
                      title={isSelf ? 'Cannot disable your own account' : 'Toggle status'}
                      aria-label={`Toggle status for ${u.email}`}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {u.status === 'active' ? (
                        <PowerOff className="w-4 h-4 text-red-400" />
                      ) : (
                        <Power className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm border-t border-slate-700 pt-4">
        <button
          disabled={history.length === 0}
          onClick={() => {
            const newHistory = [...history];
            const prev = newHistory.pop();
            setHistory(newHistory);
            setCursor(prev || null);
          }}
          className="px-4 py-2 bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-600 transition-colors"
        >
          Previous
        </button>
        <span className="text-slate-400">Page {history.length + 1}</span>
        <button
          disabled={!nextCursor}
          onClick={() => {
            if (nextCursor) {
              setHistory([...history, cursor || '']);
              setCursor(nextCursor);
            }
          }}
          className="px-4 py-2 bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-600 transition-colors"
        >
          Next
        </button>
      </div>

      {selectedUserId && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
};

export const App: FC = () => {
  const [locale, setLocale] = useState<SupportedLocale>(i18n.getLocale());
  const [direction, setDirection] = useState<Direction>(i18n.getDirection());
  const [activeTab, setActiveTab] = useState<'users' | 'foods'>('users');
  const { user, logout, isLoading } = useAdminAuth();

  const toggleLocale = (target: SupportedLocale) => {
    i18n.setLocale(target);
    setLocale(target);
    setDirection(i18n.getDirection());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return <AdminLoginScreen />;
  }

  return (
    <main
      id="admin-app-root"
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col"
      dir={direction}
    >
      <header
        id="admin-header"
        className="w-full bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-semibold">
              {i18n.t('apps.admin.title') || 'Admin Portal'}
            </h1>
          </div>

          <nav className="flex gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-4 h-4" /> Users
            </button>
            <button
              onClick={() => setActiveTab('foods')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'foods'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" /> Food Catalog
            </button>
          </nav>
        </div>

        <div className="flex gap-2 text-xs items-center">
          <button
            type="button"
            onClick={() => toggleLocale('fa')}
            className={`px-2.5 py-1 rounded ${
              locale === 'fa' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            فارسی
          </button>
          <button
            type="button"
            onClick={() => toggleLocale('en')}
            className={`px-2.5 py-1 rounded ${
              locale === 'en' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => logout()}
            className="px-4 py-1.5 ml-2 mr-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
          >
            {i18n.t('auth.logout') || 'Logout'}
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full p-8 flex flex-col gap-6">
        {activeTab === 'users' ? <AdminUserList currentUser={user} /> : <FoodCatalogManager />}
      </div>
    </main>
  );
};

export default App;
