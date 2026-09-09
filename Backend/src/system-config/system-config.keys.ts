// The four settings SystemConfig owns. Values map 1:1 to seed rows in
// Database/schemas/006_system_config.sql and to the shared fallback constants.
export const CONFIG_KEYS = {
  SLA_APPROVAL_HOURS: 'sla_approval_hours',
  DEFAULT_REORDER_LEVEL: 'default_reorder_level',
  USEFUL_LIFE_YEARS: 'useful_life_years',
  MAX_LOGIN_ATTEMPTS: 'max_login_attempts',
} as const;

export interface SystemConfigMeta {
  // ISO timestamp of the last persisted change, or null while the compiled-in
  // default is being served.
  updatedAt: string | null;
  // User id of whoever last changed it, or null (never changed / unknown).
  updatedBy: string | null;
}

export interface SystemConfigSnapshot {
  slaApprovalHours: number;
  defaultReorderLevel: number;
  usefulLifeYears: { PPE: number; SEP: number; IES: number };
  maxLoginAttempts: number;
  // Per-key provenance, keyed by CONFIG_KEYS value.
  meta: Record<string, SystemConfigMeta>;
}
