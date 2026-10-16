import type { Asset } from '@/lib/api/assets';

export interface DisposalReviewSummary {
  total: number;
  /** Still on a holder's record — a lost or stolen item stays there until COA grants relief. */
  stillAccountable: number;
  /** No holder: damaged beyond repair and surrendered, or never issued. */
  released: number;
}

export function disposalReviewSummary(assets: Asset[]): DisposalReviewSummary {
  const flagged = assets.filter((a) => a.status === 'flagged_for_disposal');
  const stillAccountable = flagged.filter((a) => a.custodianId !== null).length;
  return { total: flagged.length, stillAccountable, released: flagged.length - stillAccountable };
}
