'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Check } from 'lucide-react';
import { usersApi, type User } from '@/lib/api/users';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Employee', desc: 'Submit requisitions, browse catalogue, track own requests.' },
  { value: 'SUPERVISOR', label: 'Supervisor', desc: 'First-level approver. Reviews and approves/rejects requests.' },
  { value: 'IT_PERSONNEL', label: 'IT Personnel', desc: 'Asset custodian. Manages registry, lifecycle, forms, and issuance.' },
  { value: 'SYSTEM_ADMIN', label: 'System Administrator', desc: 'Full system access. User management, audit trail, config.' },
  { value: 'MANAGEMENT', label: 'Management', desc: 'Read-only oversight. Dashboards, reports, and audit access.' },
];

export default function RoleAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!id) return;
    usersApi.getOne(id)
      .then((res) => { setUser(res.data); setSelectedRole(res.data.role); })
      .catch(() => setError('User not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedRole) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await usersApi.updateRole(id, selectedRole);
      setSuccess('Role updated successfully.');
      setUser((prev) => prev ? { ...prev, role: selectedRole } : prev);
    } catch {
      setError('Failed to update role. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6"><LoadingSkeleton rows={6} /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-[#1a4d7a] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </button>

      <PageHeader title="Role Assignment" />

      {user && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#1a4d7a] flex items-center justify-center text-white font-semibold text-sm">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-gray-800">{user.firstName} {user.lastName}</p>
            <p className="text-sm text-gray-500">{user.email} · {user.employeeId}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Assign Role</h2>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-4 py-3 flex items-center gap-2"><Check className="w-4 h-4" />{success}</div>}

          <div className="space-y-2">
            {ROLES.map((role) => (
              <label
                key={role.value}
                className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${selectedRole === role.value ? 'border-[#1a4d7a] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selectedRole === role.value}
                  onChange={() => setSelectedRole(role.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{role.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{role.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving || selectedRole === user?.role} className="flex items-center gap-2 bg-[#1a4d7a] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors">
              <Shield className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Role'}
            </button>
            <button type="button" onClick={() => router.back()} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
