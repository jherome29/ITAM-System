import { describe, expect, it } from 'vitest';
import {
  buildUpdateSystemConfigPayload,
  type SystemConfigFormValues,
} from '@/lib/api/systemConfig';

const base: SystemConfigFormValues = {
  slaApprovalHours: '24',
  defaultReorderLevel: '10',
  maxLoginAttempts: '5',
  usefulLifePPE: '5',
  usefulLifeSEP: '3',
  usefulLifeIES: '1',
};

describe('buildUpdateSystemConfigPayload', () => {
  it('coerces every field to a number', () => {
    const p = buildUpdateSystemConfigPayload(base);
    expect(p.slaApprovalHours).toBe(24);
    expect(p.defaultReorderLevel).toBe(10);
    expect(p.maxLoginAttempts).toBe(5);
  });

  it('nests the useful-life values under usefulLifeYears', () => {
    const p = buildUpdateSystemConfigPayload({
      ...base,
      usefulLifePPE: '7',
      usefulLifeSEP: '4',
      usefulLifeIES: '2',
    });
    expect(p.usefulLifeYears).toEqual({ PPE: 7, SEP: 4, IES: 2 });
  });
});
