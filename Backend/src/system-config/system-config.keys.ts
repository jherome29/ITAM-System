// The four settings SystemConfig owns. Values map 1:1 to seed rows in
// Database/schemas/006_system_config.sql and to the shared fallback constants.
export const CONFIG_KEYS = {
  SLA_APPROVAL_HOURS: 'sla_approval_hours',
  DEFAULT_REORDER_LEVEL: 'default_reorder_level',
  USEFUL_LIFE_YEARS: 'useful_life_years',
  MAX_LOGIN_ATTEMPTS: 'max_login_attempts',
} as const;

export interface SystemConfigSnapshot {
  slaApprovalHours: number;
  defaultReorderLevel: number;
  usefulLifeYears: { PPE: number; SEP: number; IES: number };
  maxLoginAttempts: number;
}
