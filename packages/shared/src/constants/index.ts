// SVC: Plan — system-wide constants. No magic numbers anywhere else.

/** Maximum failed login attempts before account lockout (Security by Design) */
export const MAX_LOGIN_ATTEMPTS = 5;

/** JWT expiry (8 hours — one government workday) */
export const JWT_EXPIRES_IN = '8h';

/** SLA target: requisition approval must complete within 24 hours */
export const SLA_APPROVAL_HOURS = 24;

/** Alert threshold: pending approval triggers Supervisor notification after 12 hours */
export const SLA_PENDING_ALERT_HOURS = 12;

/** Inventory accuracy target: 98% */
export const INVENTORY_ACCURACY_TARGET = 0.98;

/** Asset class cost thresholds (Philippine Peso) */
export const ASSET_COST_THRESHOLDS = {
  PPE_MINIMUM: 50_000,  // >= PHP 50,000 → PPE
} as const;

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** bcrypt rounds — minimum 12 as per Security by Design requirement */
export const BCRYPT_ROUNDS = 12;

/** Supabase / PostgreSQL table names — single source of truth */
export const DB_TABLES = {
  USERS: 'users',
  ASSETS: 'assets',
  ASSET_TRANSACTIONS: 'asset_transactions',
  REQUISITIONS: 'requisitions',
  REQUISITION_ITEMS: 'requisition_items',
  AUDIT_LOGS: 'audit_logs',       // APPEND-ONLY — no UPDATE/DELETE ever
  NOTIFICATIONS: 'notifications',
  REPORTS: 'generated_reports',
  FORMS: 'generated_forms',
} as const;
