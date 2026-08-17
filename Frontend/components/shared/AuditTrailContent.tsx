'use client';

import { useEffect, useState } from 'react';
import { FileSearch, Filter, Download } from 'lucide-react';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const ACTION_OPTIONS = [
  'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED',
  'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_ISSUED', 'ASSET_RETURNED', 'ASSET_TRANSFERRED',
  'ASSET_FLAGGED_FOR_REPAIR', 'ASSET_FLAGGED_FOR_DISPOSAL',
  'REQUISITION_SUBMITTED', 'REQUISITION_APPROVED', 'REQUISITION_REJECTED', 'REQUISITION_FULFILLED',
  'REPORT_GENERATED', 'FORM_GENERATED',
];

export function AuditTrailContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    auditApi.list(page, PAGE_SIZE, actionFilter || undefined)
      .then((res) => setLogs(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, actionFilter]);

  const filtered = userFilter
    ? logs.filter((l) => l.userId.toLowerCase().includes(userFilter.toLowerCase()))
    : logs;

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User ID', 'Role', 'Action', 'Record Type', 'Record ID', 'IP Address', 'Metadata'].join(','),
      ...filtered.map((l) => [
        new Date(l.timestamp).toISOString(),
        l.userId,
        l.userRole,
        l.action,
        l.affectedRecordType ?? '',
        l.affectedRecordId ?? '',
        l.ipAddress,
        l.metadata ? JSON.stringify(l.metadata).replace(/,/g, ';') : '',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        action={<button type="button" onClick={handleExport} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"><Download className="w-4 h-4" /> Export CSV</button>}
      />
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <Filter className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Filters</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
            <select value={actionFilter} onChange={(e) => { setLoading(true); setActionFilter(e.target.value); setPage(1); }} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]">
              <option value="">All Actions</option>
              {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by User ID</label>
            <input type="text" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="Search by user ID..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Log Entries</h2>
          <span className="ml-auto text-xs text-gray-500">{filtered.length} records</span>
        </div>
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={10} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Timestamp', 'User ID', 'Role', 'Action', 'Record', 'IP Address', 'Metadata'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">No audit logs found.</td></tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-blue-50 transition-colors text-sm">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-700 font-mono text-xs">{log.userId}</td>
                      <td className="px-6 py-4 text-gray-600 text-xs">{log.userRole.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-4"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium whitespace-nowrap">{log.action.replace(/_/g, ' ')}</span></td>
                      <td className="px-6 py-4 text-gray-600">
                        {log.affectedRecordType && <span className="text-xs">{log.affectedRecordType}</span>}
                        {log.affectedRecordId && <span className="block text-xs font-mono text-gray-400">{log.affectedRecordId.slice(0, 8)}…</span>}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-500 text-xs">{log.ipAddress}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-xs truncate text-xs">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button type="button" onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)); }} disabled={page === 1 || loading} className="text-sm text-[#1a4d7a] hover:underline disabled:text-gray-400 disabled:no-underline">← Previous</button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button type="button" onClick={() => { setLoading(true); setPage((p) => p + 1); }} disabled={filtered.length < PAGE_SIZE || loading} className="text-sm text-[#1a4d7a] hover:underline disabled:text-gray-400 disabled:no-underline">Next →</button>
        </div>
      </div>
    </div>
  );
}
