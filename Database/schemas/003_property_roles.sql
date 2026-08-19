-- ============================================================
-- AIMRS — Migration 003: Property Custodian & Property Officer roles
-- Adds two values to the existing user_role ENUM (see 001_initial_schema.sql:17-19).
-- ALTER TYPE ... ADD VALUE is additive and safe — no existing row changes.
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'property_custodian';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'property_officer';
