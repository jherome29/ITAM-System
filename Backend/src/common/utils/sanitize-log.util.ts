// Fields that must never appear in log output (SECURITY.md §6.3)
const SENSITIVE_FIELDS = [
  'password',
  'passwordhash',
  'refreshtokenhash',
  'jwtsecret',
  'token',
  'authorization',
  'cookie',
];

/**
 * Strips sensitive keys from an object before writing to logs.
 * Apply to request headers and any user-supplied data before logging.
 */
export function sanitizeForLog(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([key]) => !SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f)),
    ),
  );
}
