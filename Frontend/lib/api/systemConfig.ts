import client, { type ApiResponse } from './client';

export interface SystemConfigMeta {
  updatedAt: string | null; // ISO; null while the built-in default is in effect
  updatedBy: string | null; // user id of the last editor, or null
  updatedByName?: string | null; // their name; null if unknown or the account is gone
}

export interface SystemConfig {
  slaApprovalHours: number;
  defaultReorderLevel: number;
  usefulLifeYears: { PPE: number; SEP: number; IES: number };
  maxLoginAttempts: number;
  // Repairs within 12 months that make a serviceable asset replaceable.
  repeatRepairLimit: number;
  // Printed in the header of every official COA form. The fund cluster is empty
  // until CICC sets one; the form then prints a fill-in line.
  entityName: string;
  fundCluster: string;
  // Per-key provenance, keyed by the backend CONFIG_KEYS value
  // (sla_approval_hours, default_reorder_level, useful_life_years,
  // max_login_attempts, repeat_repair_limit). Optional so older responses still type-check.
  meta?: Record<string, SystemConfigMeta>;
}

// Backend CONFIG_KEYS values — the keys of SystemConfig.meta.
export const CONFIG_META_KEYS = {
  sla: 'sla_approval_hours',
  reorder: 'default_reorder_level',
  usefulLife: 'useful_life_years',
  maxLogin: 'max_login_attempts',
  repeatRepair: 'repeat_repair_limit',
  entityName: 'entity_name',
  fundCluster: 'fund_cluster',
} as const;

export type UpdateSystemConfigPayload = Partial<
  Omit<SystemConfig, 'usefulLifeYears'>
> & { usefulLifeYears?: { PPE: number; SEP: number; IES: number } };

export interface SystemConfigFormValues {
  slaApprovalHours: string;
  defaultReorderLevel: string;
  maxLoginAttempts: string;
  repeatRepairLimit: string;
  usefulLifePPE: string;
  usefulLifeSEP: string;
  usefulLifeIES: string;
  entityName: string;
  fundCluster: string;
}

// SystemConfig (numbers from the API) -> the string values the form inputs bind to.
export function systemConfigToForm(c: SystemConfig): SystemConfigFormValues {
  return {
    slaApprovalHours: String(c.slaApprovalHours),
    defaultReorderLevel: String(c.defaultReorderLevel),
    maxLoginAttempts: String(c.maxLoginAttempts),
    repeatRepairLimit: String(c.repeatRepairLimit),
    usefulLifePPE: String(c.usefulLifeYears.PPE),
    usefulLifeSEP: String(c.usefulLifeYears.SEP),
    usefulLifeIES: String(c.usefulLifeYears.IES),
    entityName: c.entityName,
    fundCluster: c.fundCluster,
  };
}

export function buildUpdateSystemConfigPayload(
  v: SystemConfigFormValues,
): UpdateSystemConfigPayload {
  return {
    slaApprovalHours: Number(v.slaApprovalHours),
    defaultReorderLevel: Number(v.defaultReorderLevel),
    maxLoginAttempts: Number(v.maxLoginAttempts),
    repeatRepairLimit: Number(v.repeatRepairLimit),
    entityName: v.entityName.trim(),
    fundCluster: v.fundCluster.trim(),
    usefulLifeYears: {
      PPE: Number(v.usefulLifePPE),
      SEP: Number(v.usefulLifeSEP),
      IES: Number(v.usefulLifeIES),
    },
  };
}

const trimmed = (v: SystemConfigFormValues): SystemConfigFormValues => ({
  ...v,
  entityName: v.entityName.trim(),
  fundCluster: v.fundCluster.trim(),
});

/**
 * The settings that differ from what was loaded - and only those. Each setting
 * records who last changed it, so sending the untouched ones as well stamped
 * every setting as changed on every save.
 */
export function changedSystemConfigPayload(
  current: SystemConfigFormValues,
  initial: SystemConfigFormValues,
): UpdateSystemConfigPayload {
  const now = trimmed(current);
  const was = trimmed(initial);
  const all = buildUpdateSystemConfigPayload(now);
  const payload: UpdateSystemConfigPayload = {};
  if (now.slaApprovalHours !== was.slaApprovalHours) payload.slaApprovalHours = all.slaApprovalHours;
  if (now.defaultReorderLevel !== was.defaultReorderLevel) payload.defaultReorderLevel = all.defaultReorderLevel;
  if (now.maxLoginAttempts !== was.maxLoginAttempts) payload.maxLoginAttempts = all.maxLoginAttempts;
  if (now.repeatRepairLimit !== was.repeatRepairLimit) payload.repeatRepairLimit = all.repeatRepairLimit;
  if (now.entityName !== was.entityName) payload.entityName = all.entityName;
  if (now.fundCluster !== was.fundCluster) payload.fundCluster = all.fundCluster;
  // One setting on the server, so the three classes travel together.
  if (now.usefulLifePPE !== was.usefulLifePPE || now.usefulLifeSEP !== was.usefulLifeSEP || now.usefulLifeIES !== was.usefulLifeIES) {
    payload.usefulLifeYears = all.usefulLifeYears;
  }
  return payload;
}

export const systemConfigApi = {
  get: () =>
    client
      .get<ApiResponse<SystemConfig>>('/v1/system-config')
      .then((r) => r.data),

  update: (payload: UpdateSystemConfigPayload) =>
    client
      .patch<ApiResponse<SystemConfig>>('/v1/system-config', payload)
      .then((r) => r.data),
};
