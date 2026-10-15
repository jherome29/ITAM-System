import { describe, expect, it } from 'vitest';
import {
  buildUpdateSystemConfigPayload,
  changedSystemConfigPayload,
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

// Saving used to send every setting, so each one was stamped "last changed by"
// the administrator - and the audit entry listed all of them - on any save.
describe('changedSystemConfigPayload', () => {
  it('sends only the settings that differ from what was loaded', () => {
    const p = changedSystemConfigPayload({ ...base, slaApprovalHours: '36' }, base);
    expect(p).toEqual({ slaApprovalHours: 36 });
  });

  it('sends the whole useful-life group when any one of its values changed', () => {
    const p = changedSystemConfigPayload({ ...base, usefulLifeSEP: '4' }, base);
    expect(p).toEqual({ usefulLifeYears: { PPE: 5, SEP: 4, IES: 1 } });
  });

  it('sends the text settings trimmed, and can clear one', () => {
    const initial = { ...base, fundCluster: '01 Regular Agency Fund' };
    expect(changedSystemConfigPayload({ ...initial, fundCluster: '  ' }, initial)).toEqual({ fundCluster: '' });
    expect(changedSystemConfigPayload({ ...base, entityName: ' CICC ' }, base)).toEqual({ entityName: 'CICC' });
  });

  it('is empty when nothing changed', () => {
    expect(changedSystemConfigPayload(base, base)).toEqual({});
  });

  it('ignores a change that only adds whitespace', () => {
    expect(changedSystemConfigPayload({ ...base, entityName: `${base.entityName}  ` }, base)).toEqual({});
  });
});
