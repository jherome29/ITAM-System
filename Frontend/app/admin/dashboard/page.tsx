'use client';

import { useEffect, useState } from 'react';
import { Users, FileSearch, Shield, Activity } from 'lucide-react';
import { usersApi } from '@/lib/api/users';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function AdminDashboard() {
  const [userCount, setUserCount] = useState<number | string>('—');
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([usersApi.list(1, 1), auditApi.list(1, 10)])
      .then(([u, a]) => {
        const userData = u.data as unknown as { total?: number };
        setUserCount(userData?.total ?? (Array.isArray(u.data) ? (u.data as unknown[]).length : '—'));
        setRecentLogs(a.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="System Administrator Dashboard" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Users} iconColor="text-blue-600" label="Total Users" value={userCount} />
        <StatCard icon={Activity} iconColor="text-green-600" label="Active Sessions" value="—" />
        <StatCard icon={Shield} iconColor="text-purple-600" label="Security Events" value="—" />
        <StatCard icon={FileSearch} iconColor="text-orange-500" label="Audit Entries" value="—" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Recent Audit Activity</h2>
        </div>
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={6} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Timestamp', 'User ID', 'Role', 'Action', 'IP Address'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">No audit logs found.</td></tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs text-gray-700 font-mono">{log.userId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.userRole}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{log.action.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{log.ipAddress}</td>
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
