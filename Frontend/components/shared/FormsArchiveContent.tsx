'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Clock, Download, RefreshCw } from 'lucide-react';
import { reportsApi, type FormMeta } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';

export function FormsArchiveContent() {
  const [history, setHistory] = useState<FormMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(() => {
    reportsApi
      .forms(1, 50)
      .then((r) => {
        setHistory(r.data.data);
        setError('');
      })
      .catch(() => setError('Failed to load the forms archive. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setLoading(true);
    fetchHistory();
  };

  const handleDownload = async (form: FormMeta) => {
    setDownloadingId(form.id);
    try {
      const blob = await reportsApi.downloadStoredForm(form.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.formType}-${form.generatedAt.slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // The disabled-button guard (filePath !== 'stored') already prevents the
      // one truly expected failure case (pre-storage-feature records with no
      // PDF) -- anything reaching this catch is a real failure (network,
      // session expiry, backend error) and deserves visible feedback.
      setError('Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Forms Archive" />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#1a4d7a]" />
            <h2 className="text-base font-semibold text-[#1a4d7a]">Generated COA / CICC Forms</h2>
          </div>
          <button type="button" onClick={handleRefresh} className="flex items-center gap-1.5 text-xs text-[#1a4d7a] hover:text-[#143d61] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading archive…</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No forms have been generated yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((form) => (
              <div key={form.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800">{form.formType}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <Clock className="inline w-3 h-3 mr-1 -mt-0.5" />
                    {new Date(form.generatedAt).toLocaleString('en-PH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {form.relatedAssetId && (
                      <span className="ml-2 text-gray-300">· asset {form.relatedAssetId.slice(0, 8)}…</span>
                    )}
                    {form.relatedRequisitionId && (
                      <span className="ml-2 text-gray-300">· req {form.relatedRequisitionId.slice(0, 8)}…</span>
                    )}
                  </p>
                </div>
                <button type="button"
                  onClick={() => handleDownload(form)}
                  disabled={downloadingId === form.id || form.filePath !== 'stored'}
                  title={form.filePath !== 'stored' ? 'PDF not stored — regenerate from IT Personnel or Property Custodian' : 'Download stored PDF'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#1a4d7a] border border-[#1a4d7a]/30 rounded-md hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingId === form.id ? 'Downloading…' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
