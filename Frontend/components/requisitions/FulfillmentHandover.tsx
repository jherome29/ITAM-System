'use client';

import { useEffect, useState } from 'react';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { requisitionsApi, type Requisition, type RequisitionItem } from '@/lib/api/requisitions';

const isSupply = (item: RequisitionItem) => item.assetType === 'Supplies' || item.assetClass === 'IES';
const stockType = (item: RequisitionItem) => isSupply(item) ? 'Supplies' : item.assetType;
const control = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50';

type Slot = { item: RequisitionItem; key: string; index: number };
type Inventory = Record<string, Asset[]>;

const normalize = (description: string) =>
  description.normalize('NFKC').replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

function matchingInventory(item: RequisitionItem, inventory: Inventory) {
  const name = normalize(item.itemDescription);
  return (inventory[stockType(item)] ?? []).filter((asset) => normalize(asset.itemDescription) === name);
}

function automaticSelections(slots: Slot[], inventory: Inventory) {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = JSON.stringify([stockType(slot.item), normalize(slot.item.itemDescription)]);
    const group = groups.get(key) ?? [];
    group.push(slot);
    groups.set(key, group);
  }

  const selections: Record<string, Asset> = {};
  for (const group of groups.values()) {
    const item = group[0].item;
    const matches = matchingInventory(item, inventory);
    if (isSupply(item)) {
      const total = group.reduce((quantity, slot) => quantity + slot.item.quantity, 0);
      const smallestOrder = Math.min(...group.map((slot) => slot.item.quantity));
      const candidates = matches.filter((asset) => asset.quantity >= smallestOrder);
      if (candidates.length === 1 && candidates[0].quantity >= total) {
        for (const slot of group) selections[slot.key] = candidates[0];
      }
    } else if (matches.length === group.length && new Set(matches.map((asset) => asset.assetClass)).size === 1) {
      group.forEach((slot, index) => { selections[slot.key] = matches[index]; });
    }
  }
  return selections;
}

const inventoryLabel = (asset: Asset, supply: boolean) =>
  [asset.itemDescription, asset.propertyNumber, asset.serialNumber, supply ? `${asset.quantity} on hand` : asset.assetClass].filter(Boolean).join(' · ');

async function availableInventory(type: string) {
  const load = (page: number) => assetsApi.list(page, 100, undefined, 'available', type);
  const { data: first } = await load(1);
  const records = [...first.data];
  for (let page = 2; page <= (first.totalPages ?? 1); page++) {
    records.push(...(await load(page)).data.data);
  }
  return records.filter((asset) => asset.condition === 'serviceable' &&
    (type === 'Supplies' ? asset.assetClass === 'IES' : asset.assetClass !== 'IES' && !asset.custodianId))
    .sort((a, b) => a.itemDescription.localeCompare(b.itemDescription));
}

export function FulfillmentHandover({ id, requestNumber, onClose, onFulfilled }: Readonly<{
  id: string;
  requestNumber: string;
  onClose: () => void;
  onFulfilled: () => void;
}>) {
  const [request, setRequest] = useState<Requisition>();
  const [inventory, setInventory] = useState<Inventory>({});
  const [manualPicks, setManualPicks] = useState<Record<string, string>>({});
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    requisitionsApi.getOne(id).then(async ({ data: details }) => {
      const types = [...new Set(details.items.map(stockType))];
      const stocks = await Promise.all(types.map(async (type) => [type, await availableInventory(type)] as const));
      if (!current) return;
      setInventory(Object.fromEntries(stocks));
      setRequest(details);
    }).catch(() => { if (current) setLoadError(true); });
    return () => { current = false; };
  }, [id]);

  const slots = (request?.items ?? []).flatMap((item) =>
    Array.from({ length: isSupply(item) ? 1 : item.quantity }, (_, index) => ({
      item, key: `${item.id}-${index}`, index,
    })),
  );
  const automatic = automaticSelections(slots, inventory);
  const picks = { ...manualPicks, ...Object.fromEntries(Object.entries(automatic).map(([key, asset]) => [key, asset.id])) };
  const canSubmit = slots.length > 0 && slots.every(({ key }) => Boolean(picks[key]));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setError('');
    setBusy(true);
    try {
      await requisitionsApi.fulfill(id, {
        recordHandover: true,
        fulfilledItems: slots.map(({ item, key }) => ({ requisitionItemId: item.id, assetId: picks[key] })),
      });
      onFulfilled();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setError((Array.isArray(message) ? message.join(' · ') : message) || 'Could not record the handover. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => { if (!busy) onClose(); };
  return (
    <CenteredModal open title={`Fulfill ${requestNumber}`} onClose={close}>
      {loadError && <p role="alert" className="text-sm text-red-700">Could not load this request or its inventory. Close and reopen to try again.</p>}
      {!request && !loadError && <p role="status" className="text-sm text-slate-600">Loading available inventory…</p>}
      {request && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-700">Confirm the inventory handed over to <strong>{request.requester?.name ?? 'the requester'}</strong>.</p>
          {slots.map(({ item, key, index }) => {
            const supply = isSupply(item);
            const label = item.itemDescription + (supply ? ` · Qty ${item.quantity}` : item.quantity > 1 ? ` · Unit ${index + 1} of ${item.quantity}` : '');
            const exactMatches = matchingInventory(item, inventory);
            const query = normalize(searches[key] ?? '');
            const manualSearch = !exactMatches.length;
            const candidates = manualSearch
              ? (inventory[stockType(item)] ?? []).filter((asset) => query.length >= 2 &&
                  [asset.itemDescription, asset.propertyNumber, asset.serialNumber, asset.itemCode]
                    .some((value) => value && normalize(value).includes(query)))
              : exactMatches;
            const options = candidates.filter((asset) => {
              const otherPicks = slots.filter((slot) => slot.key !== key && picks[slot.key] === asset.id);
              return supply
                ? asset.quantity >= item.quantity + otherPicks.reduce((total, slot) => total + slot.item.quantity, 0)
                : !otherPicks.length;
            });

            if (automatic[key]) {
              return (
                <div key={key} className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {inventoryLabel(automatic[key], supply)}
                  </p>
                </div>
              );
            }

            return (
              <div key={key} className="space-y-2">
                {manualSearch && (
                  <label className="block space-y-1.5 text-sm text-slate-700">
                    <span>No exact inventory match for {label}. Search by model, property number, or serial number.</span>
                    <input type="search" value={searches[key] ?? ''} disabled={busy} className={control}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSearches((current) => ({ ...current, [key]: value }));
                        setManualPicks((current) => ({ ...current, [key]: '' }));
                      }} />
                  </label>
                )}
                <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
                  <span>{label}</span>
                  <select required value={picks[key] ?? ''} disabled={busy || !options.length} className={control}
                    onChange={(event) => setManualPicks((current) => ({ ...current, [key]: event.target.value }))}>
                    <option value="">{options.length ? supply ? 'Choose a stock record' : 'Choose a property or serial number'
                      : manualSearch && query.length < 2 ? 'Search inventory to see options'
                      : supply ? 'No matching stock record has enough units' : 'No available matching units'}</option>
                    {options.map((asset) => <option key={asset.id} value={asset.id}>{inventoryLabel(asset, supply)}</option>)}
                  </select>
                </label>
              </div>
            );
          })}
          {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={busy || !canSubmit} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Recording…' : 'Confirm handover'}
            </button>
          </div>
        </form>
      )}
    </CenteredModal>
  );
}
