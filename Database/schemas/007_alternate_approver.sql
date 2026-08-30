-- 007_alternate_approver.sql
-- Alternate Approver (CLAUDE.md §5, §17).
-- Run manually in the Supabase SQL editor, statement by statement
-- (ALTER TYPE ... ADD VALUE is not valid inside a transaction block).
-- synchronize:false — see CLAUDE.md §11#11.

-- users: per-supervisor backup + manual availability flag.
-- All-NULL / default-false backfill on existing rows — no data migration needed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS alternate_approver_id uuid NULL REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable_until timestamptz NULL;

-- requisitions: "was handed to an alternate" marker (route-once guard + timeline record).
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS alternate_routed_at timestamptz NULL;

-- new audit action for a reassignment event.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'requisition_reassigned';
