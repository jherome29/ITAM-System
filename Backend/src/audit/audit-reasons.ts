/**
 * Values of `metadata.reason` on audit rows that share an action with another
 * kind of event.
 */

/**
 * A refresh cookie that no longer matches the stored hash — a superseded
 * session (a second sign-in, a reload racing a rotation) rather than a wrong
 * password. It is logged as USER_LOGIN_FAILED because the action column is a
 * native PG enum with no value for it, so anything that counts failed logins
 * must exclude this reason.
 */
export const AUDIT_REASON_REFRESH_TOKEN_REUSE = 'refresh_token_reuse_detected';
