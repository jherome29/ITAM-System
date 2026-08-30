import client, { type ApiResponse } from './client';

export interface SystemConfig {
  slaApprovalHours: number;
  defaultReorderLevel: number;
  usefulLifeYears: { PPE: number; SEP: number; IES: number };
  maxLoginAttempts: number;
}

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
