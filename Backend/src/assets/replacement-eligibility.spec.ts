import { replacementEligibility } from './replacement-eligibility';
import {
  AssetClass,
  AssetCondition,
  AssetStatus,
} from '../../../packages/shared/src/enums';

const USEFUL_LIFE = { PPE: 5, SEP: 3, IES: 1 } as Record<AssetClass, number>;
const NOW = new Date('2026-10-11T00:00:00Z').getTime();

const asset = (
  over: Partial<Parameters<typeof replacementEligibility>[0]> = {},
) => ({
  status: AssetStatus.ISSUED,
  condition: AssetCondition.SERVICEABLE,
  acquisitionDate: new Date('2026-01-01'),
  assetClass: AssetClass.PPE,
  ...over,
});

describe('replacementEligibility (CLAUDE.md §17)', () => {
  it('refuses a serviceable asset within its useful life, saying why', () => {
    const r = replacementEligibility(asset(), USEFUL_LIFE, NOW);
    expect(r).toMatchObject({ eligible: false, basis: null });
    expect(r.reason).toMatch(
      /within its useful life.*5-year threshold for PPE/,
    );
  });

  it('allows an issued asset that is no longer serviceable', () => {
    expect(
      replacementEligibility(
        asset({ condition: AssetCondition.UNSERVICEABLE }),
        USEFUL_LIFE,
        NOW,
      ),
    ).toMatchObject({ eligible: true, basis: 'condition' });
  });

  it('allows an issued asset past its class useful life', () => {
    expect(
      replacementEligibility(
        asset({
          assetClass: AssetClass.SEP,
          acquisitionDate: new Date('2023-01-01'),
        }),
        USEFUL_LIFE,
        NOW,
      ),
    ).toMatchObject({ eligible: true, basis: 'useful_life' });
  });

  it('allows a held asset flagged for disposal (lost, stolen or written off)', () => {
    expect(
      replacementEligibility(
        asset({ status: AssetStatus.FLAGGED_FOR_DISPOSAL }),
        USEFUL_LIFE,
        NOW,
      ),
    ).toMatchObject({ eligible: true, basis: 'loss_or_damage' });
  });

  it('refuses while the asset is under repair', () => {
    const r = replacementEligibility(
      asset({
        status: AssetStatus.UNDER_REPAIR,
        condition: AssetCondition.FOR_REPAIR,
      }),
      USEFUL_LIFE,
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/under repair/i);
  });

  it('refuses an asset that is not issued', () => {
    expect(
      replacementEligibility(
        asset({ status: AssetStatus.RETURNED }),
        USEFUL_LIFE,
        NOW,
      ).eligible,
    ).toBe(false);
  });

  it('refuses a serviceable asset with no acquisition date instead of guessing its age', () => {
    const r = replacementEligibility(
      asset({ acquisitionDate: null as unknown as Date }),
      USEFUL_LIFE,
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/no acquisition date/);
  });
});
