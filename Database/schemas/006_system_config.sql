-- 006_system_config.sql
-- System Configuration key-value store (SYSTEM-STATUS.md next-work #2).
-- Run manually in the Supabase SQL editor, statement by statement
-- (ALTER TYPE ... ADD VALUE is not valid inside a transaction block).
-- synchronize:false — see CLAUDE.md §11#11.

CREATE TABLE IF NOT EXISTS system_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid NULL
);

-- Seed defaults = the current compiled-in constants. ON CONFLICT DO NOTHING so a
-- re-run never clobbers an admin edit.
INSERT INTO system_config (key, value) VALUES
  ('sla_approval_hours',    '24'::jsonb),
  ('default_reorder_level', '10'::jsonb),
  ('useful_life_years',     '{"PPE":5,"SEP":3,"IES":1}'::jsonb),
  ('max_login_attempts',    '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'system_config_updated';
