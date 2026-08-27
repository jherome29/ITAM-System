-- 004_supply_stock_and_notification_dedup.sql
-- Supply stock model + notification dedup stamps.
-- Run manually in the Supabase SQL editor (synchronize:false outside NODE_ENV=test).

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reorder_level integer,
  ADD COLUMN IF NOT EXISTS expected_return_date date,
  ADD COLUMN IF NOT EXISTS low_stock_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;

ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS sla_breach_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_nudge_notified_at timestamptz;
