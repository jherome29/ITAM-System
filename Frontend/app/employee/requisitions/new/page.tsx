'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { requisitionsApi } from '@/lib/api/requisitions';

const ASSET_TYPES = ['ICT', 'Fixed', 'Supplies'];
const ASSET_CLASSES = ['PPE', 'SEP', 'IES'];
const REQ_TYPES = ['new', 'replacement', 'repair', 'supply'];

export default function SubmitRequisitionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    requisitionType: 'new',
    itemDescription: '',
    assetType: 'ICT',
    assetClass: 'SEP',
    quantity: 1,
    justification: '',
    requiredDate: '',
  });

  const set = (field: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requisitionsApi.create({
        requisitionType: form.requisitionType,
        justification: form.justification,
        requiredDate: form.requiredDate,
        items: [{ itemDescription: form.itemDescription, quantity: form.quantity, assetType: form.assetType, assetClass: form.assetClass }],
      });
      router.push('/employee/requisitions');
    } catch {
      setError('Failed to submit requisition. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-100 flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#1a4d7a]" />
          <h1 className="text-xl font-semibold text-[#1a4d7a]">Submit Requisition</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requisition Type</label>
            <select value={form.requisitionType} onChange={(e) => set('requisitionType', e.target.value)} className={inputClass} required>
              {REQ_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
            <input
              type="text"
              value={form.itemDescription}
              onChange={(e) => set('itemDescription', e.target.value)}
              className={inputClass}
              placeholder="e.g., Dell Latitude 5420 Laptop"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
              <select value={form.assetType} onChange={(e) => set('assetType', e.target.value)} className={inputClass}>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Class</label>
              <select value={form.assetClass} onChange={(e) => set('assetClass', e.target.value)} className={inputClass}>
                {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set('quantity', parseInt(e.target.value, 10))}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Date</label>
            <input
              type="date"
              value={form.requiredDate}
              onChange={(e) => set('requiredDate', e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Justification</label>
            <textarea
              value={form.justification}
              onChange={(e) => set('justification', e.target.value)}
              className={inputClass}
              rows={4}
              placeholder="Explain why you need this item..."
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1a4d7a] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors duration-150"
            >
              {loading ? 'Submitting...' : 'Submit Requisition'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
