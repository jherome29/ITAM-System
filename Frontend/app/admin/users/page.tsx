'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, Search, UserCheck, UserX, Shield } from 'lucide-react';
import Link from 'next/link';
import { usersApi, type User } from '@/lib/api/users';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const ROLES = ['EMPLOYEE', 'SUPERVISOR', 'IT_PERSONNEL', 'SYSTEM_ADMIN', 'MANAGEMENT'];

const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, string> = {
    EMPLOYEE: 'bg-gray-100 text-gray-700',
    SUPERVISOR: 'bg-blue-50 text-blue-700',
    IT_PERSONNEL: 'bg-purple-50 text-purple-700',
    SYSTEM_ADMIN: 'bg-red-50 text-red-700',
    MANAGEMENT: 'bg-green-50 text-green-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {role.replace(/_/g, ' ')}
    </span>
  );
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchUsers = (q?: string) => {
    usersApi.list(1, 50, q)
      .then((res) => setUsers(res.data.data))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchUsers(search.trim() || undefined);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this user account?')) return;
    setDeactivating(id);
    try {
      await usersApi.deactivate(id);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, isActive: false } : u));
    } catch {
      setError('Failed to deactivate user.');
    } finally {
      setDeactivating(null);
    }
  };

  const active = users.filter((u) => u.isActive).length;
  const inactive = users.filter((u) => !u.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        action={
          <Link href="/admin/users/new" className="flex items-center gap-2 bg-[#1a4d7a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors">
            <Plus className="w-4 h-4" /> Add User
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Total Users</p><p className="text-2xl font-bold text-gray-800">{users.length}</p></div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="p-2 bg-green-50 rounded-lg"><UserCheck className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Active</p><p className="text-2xl font-bold text-gray-800">{active}</p></div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="p-2 bg-red-50 rounded-lg"><UserX className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-xs text-gray-500">Inactive</p><p className="text-2xl font-bold text-gray-800">{inactive}</p></div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="p-2 bg-purple-50 rounded-lg"><Shield className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs text-gray-500">Roles</p><p className="text-2xl font-bold text-gray-800">{ROLES.length}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1a4d7a]" />
            <h2 className="text-base font-semibold text-[#1a4d7a]">All Users</h2>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] w-56"
              />
            </div>
            <button type="submit" className="bg-[#1a4d7a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors">Search</button>
          </form>
        </div>

        {error && <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={8} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Employee ID', 'Name', 'Email', 'Role', 'Division / Section', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">No users found.</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">{user.employeeId}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{user.firstName} {user.lastName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.division} / {user.officeOrSection}</td>
                      <td className="px-6 py-4"><StatusBadge status={user.isActive ? 'active' : 'inactive'} /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/users/${user.id}/role`} className="text-xs text-[#1a4d7a] hover:underline font-medium">Edit Role</Link>
                          {user.isActive && (
                            <button
                              onClick={() => handleDeactivate(user.id)}
                              disabled={deactivating === user.id}
                              className="text-xs text-red-600 hover:underline font-medium disabled:opacity-50"
                            >
                              {deactivating === user.id ? 'Deactivating...' : 'Deactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
