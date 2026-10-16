import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { disposalReviewSummary } from './disposal-review';

const asset = (over: Partial<Asset>): Asset =>
  ({ id: 'a', status: 'flagged_for_disposal', custodianId: null, ...over }) as Asset;

// Disposal Review (Property Officer) showed two made-up recommendations. It is
// now the real list of assets flagged for disposal — and whether the person
// they were last issued to still carries the accountability.
describe('disposalReviewSummary', () => {
  it("splits flagged assets into those still on a holder's record and those released", () => {
    const s = disposalReviewSummary([
      asset({ id: '1', custodianId: 'emp-1' }), // lost: stays on the holder until COA relief
      asset({ id: '2', custodianId: null }),
      asset({ id: '3', custodianId: null }),
    ]);
    expect(s).toEqual({ total: 3, stillAccountable: 1, released: 2 });
  });

  it('ignores assets that are not flagged for disposal', () => {
    expect(disposalReviewSummary([asset({ status: 'available' }), asset({ status: 'disposed' })])).toEqual({
      total: 0,
      stillAccountable: 0,
      released: 0,
    });
  });
});
