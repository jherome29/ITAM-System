import client, { type ApiResponse } from './client';

export interface SystemConfigMeta {
  updatedAt: string | null; // ISO; null while the built-in default is in effect
  updatedBy: string | null; // user id of the last editor, or null
}

export interface SystemConfig {
  slaApprovalHours: number;
  defaultReorderLevel: number;
  usefulLifeYears: { PPE: number; SEP: number; IES: number };
  maxLoginAttempts: number;
  // Per-key provenance, keyed by the backend CONFIG_KEYS value
  // (sla_approval_hours, default_reorder_level, useful_life_years,
  // max_login_attempts). Optional so older responses still type-check.
  meta?: Record<string, SystemConfigMeta>;
}

// Backend CONFIG_KEYS values — the keys of SystemConfig.meta.
export const CONFIG_META_KEYS = {
  sla: 'sla_approval_hours',
  reorder: 'default_reorder_level',
  usefulLife: 'useful_life_years',
  maxLogin: 'max_login_attempts',
} as const;

export type UpdateSystemConfigPayload = Partial<
  Omit<SystemConfig, 'usefulLifeYears'>
> & { usefulLifeYears?: { PPE: number; SEP: number; IES: number } };

export interface SystemConfigFormValues {
  slaApprovalHours: string;
  defaultReorderLevel: string;
  maxLoginAttempts: string;
  usefulLifePPE: string;
  usefulLifeSEP: string;
  usefulLifeIES: string;
}

// SystemConfig (numbers from the API) -> the string values the form inputs bind to.
export function systemConfigToForm(c: SystemConfig): SystemConfigFormValues {
  return {
    slaApprovalHours: String(c.slaApprovalHours),
    defaultReorderLevel: String(c.defaultReorderLevel),
    maxLoginAttempts: String(c.maxLoginAttempts),
    usefulLifePPE: String(c.usefulLifeYears.PPE),
    usefulLifeSEP: String(c.usefulLifeYears.SEP),
    usefulLifeIES: String(c.usefulLifeYears.IES),
  };
}

export function buildUpdateSystemConfigPayload(
  v: SystemConfigFormValues,
): UpdateSystemConfigPayload {
  return {
    slaApprovalHours: Number(v.slaApprovalHours),
    defaultReorderLevel: Number(v.defaultReorderLevel),
    maxLoginAttempts: Number(v.maxLoginAttempts),
    usefulLifeYears: {
      PPE: Number(v.usefulLifePPE),
      SEP: Number(v.usefulLifeSEP),
      IES: Number(v.usefulLifeIES),
    },
  };
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
