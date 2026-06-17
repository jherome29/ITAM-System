-- ============================================================
-- AIMRS — Security Hardening Migration (002)
-- Run AFTER 001_initial_schema.sql
-- Applies audit log immutability and refresh token columns.
-- ============================================================
-- NOTE: In dev, TypeORM synchronize:true auto-creates these
-- columns from the entity. Run this file manually in production
-- where synchronize:false and migrations are used.
-- ============================================================

-- ─── REFRESH TOKEN COLUMNS ON USERS ──────────────────────
-- Stored as bcrypt hash — raw token only in httpOnly cookie
-- Single-use rotation: old hash is invalidated on each refresh

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS refresh_token_hash        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at  TIMESTAMP WITH TIME ZONE;

-- ─── AUDIT LOG IMMUTABILITY ───────────────────────────────
-- COA compliance requirement: audit records are permanent.
-- Enforced at both application level (no UPDATE/DELETE methods)
-- and database level (REVOKE + trigger below).

-- Run as superuser or a role with GRANT OPTION:
-- REVOKE UPDATE, DELETE ON audit_logs FROM aimrs_app_user;

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records cannot be modified or deleted. COA compliance requirement.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutability ON audit_logs;

CREATE TRIGGER audit_log_immutability
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ─── TOKEN VERSION COLUMN ─────────────────────────────────────
-- Concurrent session kill: incrementing this on each login
-- invalidates all previously issued JWTs for that user.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL;

-- ─── PRODUCTION ONLY: RESTRICTED APP USER ────────────────────
-- Run ONLY on CICC production PostgreSQL — skip on Supabase dev.
-- Creates a dedicated DB user with minimal permissions so a
-- compromised app cannot DROP tables or delete audit records.
--
-- Steps (run as superuser on the production PostgreSQL server):
--
-- 1. Create the restricted user:
--    CREATE USER aimrs_app WITH PASSWORD '<64-char random password>';
--
-- 2. Grant only what the app needs:
--    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO aimrs_app;
--    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aimrs_app;
--
-- 3. Apply for future tables created by migrations:
--    ALTER DEFAULT PRIVILEGES IN SCHEMA public
--      GRANT SELECT, INSERT, UPDATE ON TABLES TO aimrs_app;
--
-- 4. Explicitly block destructive operations:
--    REVOKE DELETE ON users FROM aimrs_app;       -- soft-delete only (isActive=false)
--    REVOKE DELETE ON audit_logs FROM aimrs_app;  -- immutable (trigger above + RBAC)
--
-- 5. Update DATABASE_URL in production .env to use aimrs_app credentials.
-- ─────────────────────────────────────────────────────────────
