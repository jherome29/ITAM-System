import {
  DEMO_ASSETS,
  DEMO_ASSET_REQUESTS,
  DEMO_ISSUANCES,
  DEMO_PROPERTY_PREFIX,
  DEMO_REQUISITIONS,
  DEMO_TAG,
  coverage,
  custodianFor,
  replacementCandidateKeys,
  validateScenario,
} from './scenario';
import { AssetType, UserRole } from '../../../packages/shared/src/enums';

// The demo scenario is data, but it is data that must satisfy the real API:
// every payload is checked against the same DTO classes the controllers use,
// so a rule change (a longer minimum, a renamed field) fails here instead of
// halfway through a seed run against a shared database.

describe('demo scenario', () => {
  it('has no structural problems', () => {
    expect(validateScenario()).toEqual([]);
  });

  it('tags every asset with a unique DEMO property number and serial', () => {
    const property = DEMO_ASSETS.map((a) => a.dto.propertyNumber);
    const serial = DEMO_ASSETS.map((a) => a.dto.serialNumber);
    for (const value of [...property, ...serial]) {
      expect(value?.startsWith(DEMO_PROPERTY_PREFIX)).toBe(true);
    }
    expect(new Set(property).size).toBe(property.length);
    expect(new Set(serial).size).toBe(serial.length);
  });

  it('marks every free-text request as demo data', () => {
    for (const r of DEMO_REQUISITIONS) {
      expect(r.justification.startsWith(DEMO_TAG)).toBe(true);
    }
    for (const r of DEMO_ASSET_REQUESTS) {
      expect(r.details.startsWith(DEMO_TAG)).toBe(true);
    }
  });

  it('routes each asset to the custodian role that owns its type', () => {
    expect(custodianFor(AssetType.ICT)).toBe(UserRole.IT_PERSONNEL);
    expect(custodianFor(AssetType.FIXED)).toBe(UserRole.PROPERTY_CUSTODIAN);
    expect(custodianFor(AssetType.SUPPLIES)).toBe(UserRole.PROPERTY_CUSTODIAN);
  });

  it('only issues and files against assets that exist', () => {
    const keys = new Set(DEMO_ASSETS.map((a) => a.key));
    for (const i of DEMO_ISSUANCES) expect(keys.has(i.asset)).toBe(true);
    for (const r of DEMO_ASSET_REQUESTS) expect(keys.has(r.asset)).toBe(true);
  });

  // The validator is only worth trusting if it fails when the data is wrong.
  // Each case breaks one rule in place, checks it is reported, and restores.
  describe('validateScenario catches', () => {
    function broken<T extends object>(target: T, patch: Partial<T>): string[] {
      const original = { ...target };
      Object.assign(target, patch);
      try {
        return validateScenario();
      } finally {
        Object.assign(target, original);
      }
    }

    it('a request body the API would reject', () => {
      const problems = broken(DEMO_ASSET_REQUESTS[0], {
        details: `${DEMO_TAG} short`,
      });
      expect(problems.join('\n')).toMatch(/at least 15 characters/);
    });

    it('two open requests on one asset', () => {
      const problems = broken(DEMO_ASSET_REQUESTS[1], {
        asset: DEMO_ASSET_REQUESTS[0].asset,
      });
      expect(problems.join('\n')).toMatch(/open requests/);
    });

    it('an issuance of an asset that is not defined', () => {
      const problems = broken(DEMO_ISSUANCES[0], { asset: 'no-such-asset' });
      expect(problems.join('\n')).toMatch(/unknown asset "no-such-asset"/);
    });

    it('a rejection with no reason given', () => {
      const rejected = DEMO_REQUISITIONS.find((r) => r.outcome === 'rejected')!;
      const problems = broken(rejected, { comments: undefined });
      expect(problems.join('\n')).toMatch(/rejection needs comments/);
    });

    it('a fulfilment that draws more stock than exists', () => {
      const fulfilled = DEMO_REQUISITIONS.find(
        (r) => r.key === 'paper-fulfilled',
      )!;
      const problems = broken(fulfilled, {
        items: [{ ...fulfilled.items[0], quantity: 9_999 }],
      });
      expect(problems.join('\n')).toMatch(/not enough "paper" stock/);
    });

    it('a request that has lost the demo marker', () => {
      const problems = broken(DEMO_REQUISITIONS[0], {
        justification: 'Field investigators need a laptop for on-site imaging.',
      });
      expect(problems.join('\n')).toMatch(/missing the "\[DEMO\]" marker/);
    });

    it('an asset registered without the demo marker', () => {
      const problems = broken(DEMO_ASSETS[0].dto, {
        propertyNumber: 'CICC-REAL-0001',
      });
      expect(problems.join('\n')).toMatch(/demo marker/);
    });
  });

  it('lists replacement candidates the way the replacement screen will', () => {
    // Held and past useful life, or lost/stolen (stays on the holder's record
    // until COA relief) — but not the desk, whose write-off clears the holder,
    // nor the desktop and cabinet that already have a replacement request open.
    expect(replacementCandidateKeys().sort()).toEqual([
      'chair-old',
      'laptop-lost',
      'printer-old',
      'tv-stolen',
    ]);
  });

  it('gives every role something to act on', () => {
    const c = coverage();
    // Supervisor: a queue to decide, and decisions already made.
    expect(c.supervisorPending).toBeGreaterThan(0);
    expect(c.supervisorDecided).toBeGreaterThan(0);
    // IT Personnel / Property Custodian: approved requisitions to fulfil and
    // holder requests (return / repair / incident) to process.
    expect(c.itFulfilment).toBeGreaterThan(0);
    expect(c.pcFulfilment).toBeGreaterThan(0);
    expect(c.itAssetRequests).toBeGreaterThan(0);
    expect(c.pcAssetRequests).toBeGreaterThan(0);
    // Replacement validation and disposal review are scoped by asset type, so
    // each custodian domain needs its own: ICT for IT Personnel, Fixed and
    // Supplies for the Property Custodian and Property Officer. (A lost laptop
    // is invisible to the Property Officer — that gap shipped once already.)
    for (const scope of [c.it, c.po]) {
      expect(scope.replacementRequests).toBeGreaterThan(0);
      expect(scope.replacementCandidates).toBeGreaterThan(0);
      expect(scope.disposalCandidates).toBeGreaterThan(0);
    }
    // Alerts for Management / Admin to see: low stock and an overdue loan.
    expect(c.lowStockSupplies).toBeGreaterThan(0);
    expect(c.overdueLoans).toBeGreaterThan(0);
  });
});
