'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { usersApi, type CreateUserDto } from '@/lib/api/users';
import { PageHeader } from '@/components/ui/PageHeader';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'IT_PERSONNEL', label: 'IT Personnel' },
  { value: 'SYSTEM_ADMIN', label: 'System Administrator' },
  { value: 'MANAGEMENT', label: 'Management' },
];

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

const Field = ({ label, required, children }: Readonly<{ label: string; required?: boolean; children: React.ReactNode }>) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateUserDto>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    employeeId: '',
    role: 'EMPLOYEE',
    division: '',
    officeOrSection: '',
  });

  const set = (key: keyof CreateUserDto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await usersApi.create(form);
      router.push('/admin/users');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create user. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-[#1a4d7a] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <PageHeader title="Add New User" />

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">User Account Information</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" required>
              <input type="text" value={form.firstName} onChange={set('firstName')} className={inputClass} required />
            </Field>
            <Field label="Last Name" required>
              <input type="text" value={form.lastName} onChange={set('lastName')} className={inputClass} required />
            </Field>
          </div>

          <Field label="Email Address" required>
            <input type="email" value={form.email} onChange={set('email')} className={inputClass} required />
          </Field>

          <Field label="Employee ID" required>
            <input type="text" value={form.employeeId} onChange={set('employeeId')} placeholder="e.g. CICC-2024-001" className={inputClass} required />
          </Field>

          <Field label="Temporary Password" required>
            <input type="password" value={form.password} onChange={set('password')} className={inputClass} minLength={8} required />
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters. User should change on first login.</p>
          </Field>

          <Field label="Role" required>
            <select value={form.role} onChange={set('role')} className={inputClass} required>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Division" required>
              <input type="text" value={form.division} onChange={set('division')} className={inputClass} required />
            </Field>
            <Field label="Office / Section" required>
              <input type="text" value={form.officeOrSection} onChange={set('officeOrSection')} className={inputClass} required />
            </Field>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#1a4d7a] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors">
              <UserPlus className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create User'}
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
