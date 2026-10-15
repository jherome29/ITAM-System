import {
  PAGES_ASSETS,
  PAGES_PROPERTY_PREFIX,
  PAGES_STEPS,
  Step,
  pagesCoverage,
  validatePages,
} from './scenario-pages';
import { DEMO_TAG } from './scenario';
import { AssetType } from '../../../packages/shared/src/enums';

// "No page should look empty." The base scenario fills the requisition and incident
// queues; this one fills the pages it leaves bare (Maintenance & Repair, My Assigned
// Assets and My Requisitions for every role, the admin's escalation queues, transferred
// and disposed assets, a completed replacement). Like the base scenario it is data that
// must satisfy the real API, so it is checked against the real DTOs and against a
// simulation of each asset's lifecycle - a step the API would refuse fails here, not
// halfway through a run against a shared database.

describe('pages scenario', () => {
  it('has no structural problems', () => {
    expect(validatePages()).toEqual([]);
  });

  it('keeps every asset marked and distinct from the base scenario', () => {
    for (const a of PAGES_ASSETS) {
      expect(a.dto.propertyNumber?.startsWith(PAGES_PROPERTY_PREFIX)).toBe(
        true,
      );
      expect(a.dto.serialNumber?.startsWith('DEMO-')).toBe(true);
    }
    const numbers = PAGES_ASSETS.map((a) => a.dto.propertyNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('marks every free-text request as demo data', () => {
    for (const s of PAGES_STEPS) {
      if (s.do === 'requisition')
        expect(s.justification.startsWith(DEMO_TAG)).toBe(true);
      if (s.do === 'assetRequest')
        expect(s.details.startsWith(DEMO_TAG)).toBe(true);
      if (s.do === 'repair') expect(s.problem.startsWith(DEMO_TAG)).toBe(true);
    }
  });

  describe('gives every page something to show', () => {
    const c = pagesCoverage();

    it('Maintenance & Repair: an open repair in every state a custodian meets', () => {
      expect(c.openRepairs.inHouse).toBeGreaterThan(0);
      expect(c.openRepairs.external).toBeGreaterThan(0);
      expect(c.openRepairs.overdue).toBeGreaterThan(0);
      expect(c.openRepairs.withLoaner).toBeGreaterThan(0);
    });

    it('Maintenance & Repair: both custodians have repairs of their own asset type', () => {
      expect(c.openRepairs.ict).toBeGreaterThan(0);
      expect(c.openRepairs.fixed).toBeGreaterThan(0);
    });

    it('Repair history: finished repairs, a write-off, and an item repaired repeatedly', () => {
      expect(c.closedRepairs.repaired).toBeGreaterThan(0);
      expect(c.closedRepairs.unrepairable).toBeGreaterThan(0);
      expect(c.repeatRepairAssets).toBeGreaterThan(0);
    });

    it('My Assigned Assets: every role holds something', () => {
      for (const holder of [
        'supervisor',
        'it_personnel',
        'property_custodian',
        'property_officer',
        'management',
        'system_admin',
      ] as const) {
        expect(c.holders[holder]).toBeGreaterThan(0);
      }
    });

    it('My Requisitions: the Approving Officer and IT have filed their own', () => {
      expect(c.ownRequisitions.supervisor).toBeGreaterThan(0);
      expect(c.ownRequisitions.it_personnel).toBeGreaterThan(0);
    });

    it("Admin escalation queues: a custodian's own requests, some waiting and some decided", () => {
      expect(c.custodianRequests.waiting).toBeGreaterThan(0);
      expect(c.custodianRequests.decided).toBeGreaterThan(0);
      expect(c.openRepairs.heldByCustodian).toBeGreaterThan(0);
    });

    it('Dashboards and Custody: transferred and disposed assets exist', () => {
      expect(c.transferred).toBeGreaterThan(0);
      expect(c.disposed).toBeGreaterThan(0);
    });

    it('Replacement Validation: a completed replacement for each custodian domain', () => {
      expect(c.completedReplacements.ict).toBeGreaterThan(0);
      expect(c.completedReplacements.fixed).toBeGreaterThan(0);
    });

    it('Physical count sheet: assets spread over several offices', () => {
      expect(c.locations).toBeGreaterThanOrEqual(5);
    });
  });

  // The validator is only worth trusting if it fails when the data is wrong.
  describe('validatePages catches', () => {
    const problems = (mutate: () => () => void) => {
      const restore = mutate();
      try {
        return validatePages().join('\n');
      } finally {
        restore();
      }
    };
    const firstStep = <K extends Step['do']>(kind: K) =>
      PAGES_STEPS.find((s) => s.do === kind) as Extract<Step, { do: K }>;
    const index = (step: Step) => PAGES_STEPS.indexOf(step);

    it('issuing an asset that is not available', () => {
      const issue = firstStep('issue');
      expect(
        problems(() => {
          PAGES_STEPS.splice(index(issue), 0, { ...issue });
          return () => PAGES_STEPS.splice(index(issue), 1);
        }),
      ).toMatch(/not available/);
    });

    it('a repair whose loaner is a different kind of asset', () => {
      const repair = PAGES_STEPS.find(
        (s) => s.do === 'repair' && s.loaner,
      ) as Extract<Step, { do: 'repair' }>;
      const fixed = PAGES_ASSETS.find(
        (a) =>
          a.dto.assetType === AssetType.FIXED &&
          !PAGES_STEPS.some((s) => 'asset' in s && s.asset === a.key),
      )!;
      const original = repair.loaner;
      expect(
        problems(() => {
          // an ICT repair lent a Fixed asset as its loaner
          repair.loaner = fixed.key;
          return () => {
            repair.loaner = original;
          };
        }),
      ).toMatch(/loaner/);
    });

    // The API refuses a loaner that is due back in the past, and its default due date is the
    // repair's own, so a loaner on an overdue repair needs a date of its own. A live rehearsal
    // hit this (HTTP 400) before the validator knew the rule.
    describe('a loaner whose return date would be in the past', () => {
      const overdueWithLoaner = () =>
        PAGES_STEPS.find(
          (s) =>
            s.do === 'repair' && s.loaner && (s.service?.dueInDays ?? 1) < 0,
        ) as Extract<Step, { do: 'repair' }>;

      it.each([
        ['no return date of its own', undefined],
        ['a return date that has already passed', -1],
      ])('on an overdue repair, with %s', (_label, days) => {
        const repair = overdueWithLoaner();
        const original = repair.loanerReturnInDays;
        expect(
          problems(() => {
            repair.loanerReturnInDays = days;
            return () => {
              repair.loanerReturnInDays = original;
            };
          }),
        ).toMatch(/loaner return date/);
      });

      it('but needs none when the repair itself is not overdue', () => {
        const repair = overdueWithLoaner();
        const { loanerReturnInDays, service } = repair;
        expect(
          problems(() => {
            repair.loanerReturnInDays = undefined;
            repair.service = { ...service!, dueInDays: 5 };
            return () => {
              repair.loanerReturnInDays = loanerReturnInDays;
              repair.service = service;
            };
          }),
        ).not.toMatch(/loaner return date/);
      });
    });

    it('a supervisor requisition when no backup approver is set', () => {
      const backup = firstStep('backupApprover');
      expect(
        problems(() => {
          const at = index(backup);
          PAGES_STEPS.splice(at, 1);
          return () => PAGES_STEPS.splice(at, 0, backup);
        }),
      ).toMatch(/backup approver/);
    });

    it('a request filed by someone who does not hold the asset', () => {
      const req = firstStep('assetRequest');
      const original = req.by;
      expect(
        problems(() => {
          req.by = 'management';
          return () => {
            req.by = original;
          };
        }),
      ).toMatch(/does not hold/);
    });

    it("the admin deciding a request that is not a custodian's own", () => {
      const req = PAGES_STEPS.find(
        (s) => s.do === 'assetRequest' && s.decider === 'custodian',
      ) as Extract<Step, { do: 'assetRequest' }> | undefined;
      if (!req) return; // every request in the scenario is a custodian's own
      const original = req.decider;
      expect(
        problems(() => {
          req.decider = 'admin';
          return () => {
            req.decider = original;
          };
        }),
      ).toMatch(/admin/);
    });

    it('a repair with no description of the problem', () => {
      const repair = firstStep('repair');
      const original = repair.problem;
      expect(
        problems(() => {
          repair.problem = 'no marker';
          return () => {
            repair.problem = original;
          };
        }),
      ).toMatch(/marker/);
    });

    it('a repair completion with a note too short for the API', () => {
      const repair = PAGES_STEPS.find(
        (s) => s.do === 'repair' && s.finish,
      ) as Extract<Step, { do: 'repair' }>;
      const original = repair.finish!.action;
      expect(
        problems(() => {
          repair.finish!.action = 'ok';
          return () => {
            repair.finish!.action = original;
          };
        }),
      ).toMatch(/at least 5 characters/);
    });

    it('an unrepairable repair with no findings', () => {
      const repair = PAGES_STEPS.find(
        (s) => s.do === 'repair' && s.finish?.outcome === 'unrepairable',
      ) as Extract<Step, { do: 'repair' }>;
      const original = repair.finish!.findings;
      expect(
        problems(() => {
          repair.finish!.findings = undefined;
          return () => {
            repair.finish!.findings = original;
          };
        }),
      ).toMatch(/findings/);
    });
  });
});
