import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import {
  defaultStockId,
  fulfilledItemsFor,
  isSupplyLine,
  stockOptionsFor,
  stockProblem,
} from './supply-stock';

// A supply requisition is only fulfilled honestly if the custodian can see which
// stock record the quantity leaves. These rules mirror what the server does when
// no record is named, so the screen's preselection never disagrees with it.

const record = (over: Partial<Asset> = {}): Asset =>
  ({
    id: 'sup-1',
    itemDescription: 'A4 Bond Paper, 80gsm (ream)',
    assetClass: 'IES',
    assetType: 'Supplies',
    status: 'available',
    quantity: 110,
    officeLocation: 'Supply Room, 2nd Floor',
    dateOfDelivery: '2026-01-10',
    createdAt: '2026-01-10T00:00:00Z',
    ...over,
  }) as Asset;

const line = {
  id: 'line-1',
  itemDescription: 'A4 Bond Paper, 80gsm (ream)',
  assetType: 'Supplies',
  assetClass: 'IES',
  quantity: 3,
};

describe('isSupplyLine', () => {
  it('is true only for consumable (IES) lines', () => {
    expect(isSupplyLine({ assetClass: 'IES' })).toBe(true);
    expect(isSupplyLine({ assetClass: 'SEP' })).toBe(false);
    expect(isSupplyLine({ assetClass: 'PPE' })).toBe(false);
  });
});

describe('stockOptionsFor', () => {
  it('lists the matching records with what is on hand and what would be left', () => {
    const [option] = stockOptionsFor(line, [record()]);

    expect(option).toMatchObject({ id: 'sup-1', onHand: 110, remaining: 107, enough: true });
    expect(option.label).toBe('Supply Room, 2nd Floor · 110 on hand');
  });

  it('ignores another item, another asset type, a unit asset and stock that is not available', () => {
    const options = stockOptionsFor(line, [
      record({ id: 'other-item', itemDescription: 'Toner' }),
      record({ id: 'other-type', assetType: 'ICT' }),
      record({ id: 'a-unit', assetClass: 'SEP' }),
      record({ id: 'gone', status: 'disposed' }),
      record({ id: 'match' }),
    ]);

    expect(options.map((o) => o.id)).toEqual(['match']);
  });

  it('matches the description ignoring case and spacing, as the server does', () => {
    const options = stockOptionsFor(line, [record({ itemDescription: '  a4 BOND paper,   80gsm (ream) ' })]);
    expect(options).toHaveLength(1);
  });

  it('puts the oldest delivery first and marks a record that is too small', () => {
    const options = stockOptionsFor(line, [
      record({ id: 'newer', quantity: 50, dateOfDelivery: '2026-06-01' }),
      record({ id: 'older-small', quantity: 2, dateOfDelivery: '2026-01-01' }),
    ]);

    expect(options.map((o) => [o.id, o.enough])).toEqual([
      ['older-small', false],
      ['newer', true],
    ]);
  });
});

describe('defaultStockId', () => {
  it('preselects the oldest record that holds the whole quantity', () => {
    const options = stockOptionsFor(line, [
      record({ id: 'small', quantity: 1, dateOfDelivery: '2026-01-01' }),
      record({ id: 'first-enough', quantity: 5, dateOfDelivery: '2026-02-01' }),
      record({ id: 'later', quantity: 90, dateOfDelivery: '2026-03-01' }),
    ]);

    expect(defaultStockId(options)).toBe('first-enough');
  });

  it('preselects nothing when no record holds enough', () => {
    expect(defaultStockId(stockOptionsFor(line, [record({ quantity: 2 })]))).toBe('');
    expect(defaultStockId([])).toBe('');
  });
});

describe('stockProblem', () => {
  it('says there is no stock on record when nothing matches', () => {
    expect(stockProblem(line, [], '')).toBe(
      'No stock on record for "A4 Bond Paper, 80gsm (ream)". Register it first, or put the request on hold.',
    );
  });

  it('says how much the largest record holds when none holds enough', () => {
    const options = stockOptionsFor(line, [record({ quantity: 2 }), record({ id: 'b', quantity: 1 })]);

    expect(stockProblem(line, options, '')).toBe('Not enough stock: 3 requested, the largest record holds 2.');
  });

  it('flags a chosen record that is too small', () => {
    const options = stockOptionsFor(line, [record({ quantity: 2 }), record({ id: 'big', quantity: 90 })]);

    expect(stockProblem(line, options, 'sup-1')).toBe('Not enough stock in that record: 3 requested, 2 on hand.');
  });

  it('is clear when a record that holds enough is chosen', () => {
    const options = stockOptionsFor(line, [record()]);
    expect(stockProblem(line, options, 'sup-1')).toBeNull();
  });
});

describe('fulfilledItemsFor', () => {
  it('names the chosen record for every supply line and nothing for the rest', () => {
    const unit = { ...line, id: 'line-unit', assetClass: 'SEP' };

    expect(fulfilledItemsFor([line, unit], { 'line-1': 'sup-1', 'line-unit': 'ignored' })).toEqual([
      { requisitionItemId: 'line-1', assetId: 'sup-1' },
    ]);
  });

  it('leaves a supply line out when nothing is chosen, so the server resolves it', () => {
    expect(fulfilledItemsFor([line], {})).toEqual([]);
  });
});
