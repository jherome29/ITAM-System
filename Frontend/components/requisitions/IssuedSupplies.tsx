'use client';

import { useEffect, useState } from 'react';
import { SearchToolbar } from '@/components/ui/SearchToolbar';
import { Chip } from '@/components/ui/Chip';
import { Pager } from '@/components/ui/Pager';
import { buttonClass } from '@/components/ui/buttons';
import { controlBaseClass } from '@/components/ui/controls';
import { formatDate } from '@/lib/dates';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { RecordPrints } from '@/components/shared/RecordPrints';
import { requisitionsApi, type IssuedSupply } from '@/lib/api/requisitions';
import type { PaginatedResponse } from '@/lib/api/client';

const headings = ['Requisition no.', 'Supply item', 'Requested by', 'Quantity', 'Fulfilled on', 'Stock record', 'Actions'];

type DateOrder = 'newest' | 'oldest';
type Result = { page: number; search: string; sort: DateOrder; records: PaginatedResponse<IssuedSupply> | null };

export function IssuedSupplies() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DateOrder>('newest');
  const [result, setResult] = useState<Result>();
  const [selected, setSelected] = useState<IssuedSupply | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void requisitionsApi.issuedSupplies(page, search.trim(), sort, controller.signal)
        .then((records) => { if (!controller.signal.aborted) setResult({ page, search, sort, records }); })
        .catch(() => { if (!controller.signal.aborted) setResult({ page, search, sort, records: null }); });
    }, search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, sort]);

  const current = result?.page === page && result.search === search && result.sort === sort ? result : undefined;
  const records = current?.records;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <SearchToolbar bare filters={[]} value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search by supply, requester, or requisition" />
        <select
          aria-label="Sort by fulfillment date"
          value={sort}
          onChange={(event) => { setSort(event.target.value === 'oldest' ? 'oldest' : 'newest'); setPage(1); }}
          className={controlBaseClass}
        >
          <option value="newest">Fulfilled date: Newest first</option>
          <option value="oldest">Fulfilled date: Oldest first</option>
        </select>
      </div>
      <section aria-label="Issued supplies" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-sm uppercase text-slate-500">
              <tr>{headings.map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records?.data.map((row) => (
                <tr key={row.id} className="text-slate-700 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">{row.requestNumber}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-950">{row.itemDescription}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.requester?.name ?? 'Requester unavailable'}</p>
                    <p className="text-xs text-slate-500">{[row.requester?.employeeId, row.requester?.officeOrSection].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.quantity}</td>
                  <td className="px-4 py-3">{row.fulfilledAt ? formatDate(row.fulfilledAt) : 'Not recorded'}</td>
                  <td className="px-4 py-3">
                    {row.stockLinked
                      ? <Chip tone="green">Linked</Chip>
                      : <Chip>Not recorded</Chip>}
                  </td>
                  <td className="px-4 py-3">
                    {row.requisitionId && <button type="button" onClick={() => setSelected(row)} className={buttonClass({ size: 'sm' })}>Manage</button>}
                  </td>
                </tr>
              ))}
              {!records?.data.length && (
                <tr>
                  <td colSpan={headings.length} className="px-4 py-10 text-center text-slate-600">
                    {!current ? 'Loading supply records…' : !records ? 'Could not load supply records.' : 'No fulfilled supply requests found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {records && ( <Pager page={page} total={records.total} pageSize={records.limit} onPage={setPage} noun="records" />)}
      </section>
      {selected?.requisitionId && (
        <CenteredModal open title={selected.requestNumber} description={`${selected.quantity} × ${selected.itemDescription}`} onClose={() => setSelected(null)}>
          <RecordPrints kind="requisition" recordId={selected.requisitionId} stacked />
        </CenteredModal>
      )}
    </div>
  );
}
