-- 004_supply_stock_and_notification_dedup.sql
-- Supply stock model + notification dedup stamps.
-- Run manually in the Supabase SQL editor (synchronize:false outside NODE_ENV=test).
--
-- OPERATOR NOTE: existing asset_class='IES' rows land at quantity=1 against the
-- DEFAULT_REORDER_LEVEL fallback of 10, so every pre-existing supply line becomes a
-- low-stock candidate. Set real quantity / reorder_level on all IES rows BEFORE the
-- first watcher run (daily 07:00 cron, or POST /v1/notifications/run-checks), or the
-- first sweep alerts every Property Custodian + System Admin once per supply line.
-- Do NOT backfill low_stock_notified_at = now() to suppress it — a stamped row that
-- is no longer low can never be re-armed and stays silently excluded forever.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reorder_level integer,
  ADD COLUMN IF NOT EXISTS expected_return_date date,
  ADD COLUMN IF NOT EXISTS low_stock_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;

ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS sla_breach_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_nudge_notified_at timestamptz;
