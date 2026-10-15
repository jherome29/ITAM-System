import { describe, expect, it } from 'vitest';
import {
  buildUpdateSystemConfigPayload,
  systemConfigToForm,
  type SystemConfig,
  type SystemConfigFormValues,
} from '@/lib/api/systemConfig';

const base: SystemConfigFormValues = {
  slaApprovalHours: '24',
  defaultReorderLevel: '10',
  maxLoginAttempts: '5',
  repeatRepairLimit: '3',
  usefulLifePPE: '5',
  usefulLifeSEP: '3',
  usefulLifeIES: '1',
  entityName: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
  fundCluster: '',
};

const config: SystemConfig = {
  slaApprovalHours: 24,
  defaultReorderLevel: 10,
  usefulLifeYears: { PPE: 5, SEP: 3, IES: 1 },
  maxLoginAttempts: 5,
  repeatRepairLimit: 3,
  entityName: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
  fundCluster: '',
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

  // The agency name and Fund Cluster printed on every official form are settings
  // the Master Administrator edits here.
  it('sends the entity name and fund cluster, trimmed', () => {
    const p = buildUpdateSystemConfigPayload({ ...base, entityName: ' CICC Central Office ', fundCluster: '01 Regular Agency Fund ' });
    expect(p.entityName).toBe('CICC Central Office');
    expect(p.fundCluster).toBe('01 Regular Agency Fund');
  });

  it('can clear the fund cluster again', () => {
    expect(buildUpdateSystemConfigPayload({ ...base, fundCluster: '   ' }).fundCluster).toBe('');
  });
});

describe('systemConfigToForm', () => {
  it('maps every numeric config value to its string form field', () => {
    expect(systemConfigToForm(config)).toEqual({
      slaApprovalHours: '24',
      defaultReorderLevel: '10',
      maxLoginAttempts: '5',
      repeatRepairLimit: '3',
      usefulLifePPE: '5',
      usefulLifeSEP: '3',
      usefulLifeIES: '1',
      entityName: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
      fundCluster: '',
    });
  });

  it('round-trips through buildUpdateSystemConfigPayload', () => {
    expect(buildUpdateSystemConfigPayload(systemConfigToForm(config))).toEqual({
      slaApprovalHours: 24,
      defaultReorderLevel: 10,
      maxLoginAttempts: 5,
      repeatRepairLimit: 3,
      entityName: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
      fundCluster: '',
      usefulLifeYears: { PPE: 5, SEP: 3, IES: 1 },
    });
  });
});
