// The settings SystemConfig owns. Values map 1:1 to seed rows in
// Database/schemas/006_system_config.sql and to the shared fallback constants.
export const CONFIG_KEYS = {
  SLA_APPROVAL_HOURS: 'sla_approval_hours',
  DEFAULT_REORDER_LEVEL: 'default_reorder_level',
  USEFUL_LIFE_YEARS: 'useful_life_years',
  MAX_LOGIN_ATTEMPTS: 'max_login_attempts',
  REPEAT_REPAIR_LIMIT: 'repeat_repair_limit',
  // Header of every official form.
  ENTITY_NAME: 'entity_name',
  FUND_CLUSTER: 'fund_cluster',
} as const;

export interface SystemConfigMeta {
  // ISO timestamp of the last persisted change, or null while the compiled-in
  // default is being served.
  updatedAt: string | null;
  // User id of whoever last changed it, or null (never changed / unknown).
  updatedBy: string | null;
  // Their name, filled in by the controller; null when nobody changed it or the
  // account no longer exists. Not stored - the service only knows ids.
  updatedByName?: string | null;
}

export interface SystemConfigSnapshot {
  slaApprovalHours: number;
  defaultReorderLevel: number;
  usefulLifeYears: { PPE: number; SEP: number; IES: number };
  maxLoginAttempts: number;
  repeatRepairLimit: number;
  /** Agency name in the header of every official form. */
  entityName: string;
  /** Fund Cluster printed on the forms; empty until set (the form then prints a fill-in line). */
  fundCluster: string;
  // Per-key provenance, keyed by CONFIG_KEYS value.
  meta: Record<string, SystemConfigMeta>;
}
