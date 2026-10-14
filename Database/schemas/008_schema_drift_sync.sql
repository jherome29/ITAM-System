-- 008_schema_drift_sync.sql
-- Brings the schema back in line with the TypeORM entities and packages/shared
-- enums. Every item below already existed in code but had no schema file, so a
-- freshly bootstrapped database (docker-compose, CI e2e) could not serve the
-- requisition workflow or the COA form re-download at all.
--
-- Run manually in the Supabase SQL editor, statement by statement
-- (ALTER TYPE ... ADD VALUE is not valid inside a transaction block).
-- synchronize:false — see CLAUDE.md §11#11.

-- ── requisition_status ───────────────────────────────────────
-- RequisitionStatus (packages/shared) carries PENDING_SUPERVISOR and ON_HOLD.
-- Without them `GET /api/v1/requisitions?status=pending_fulfillment` fails with
-- `invalid input value for enum requisition_status: "on_hold"` — the IT custodian
-- dashboard's fulfillment query filters on IN (pending_fulfillment, on_hold).
ALTER TYPE requisition_status ADD VALUE IF NOT EXISTS 'pending_supervisor';
ALTER TYPE requisition_status ADD VALUE IF NOT EXISTS 'on_hold';

-- The original 'submitted' / 'pending_approval' / 'approved' labels are dead —
-- no code path reads or writes them. They are deliberately left in place:
-- Postgres has no DROP VALUE, and recreating the type would need a table
-- rewrite for no functional gain. Do not reintroduce them in code.

-- ── audit_action ─────────────────────────────────────────────
-- Emitted by RequisitionsService when an approved request is put on hold
-- because no asset is available to fulfil it.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'requisition_on_hold';

-- ── notification_alert_type ──────────────────────────────────
-- Requester-facing outcome alerts (CLAUDE.md §6 Module 5).
ALTER TYPE notification_alert_type ADD VALUE IF NOT EXISTS 'requisition_approved';
ALTER TYPE notification_alert_type ADD VALUE IF NOT EXISTS 'requisition_rejected';
ALTER TYPE notification_alert_type ADD VALUE IF NOT EXISTS 'requisition_fulfilled';

-- ── generated_forms.pdf_content ──────────────────────────────
-- COA form PDFs are stored as bytea in the row, not on disk (CLAUDE.md §11#10);
-- file_path only ever holds the 'stored' placeholder. Nullable so the pre-existing
-- rows written before this column stay valid — those simply have no re-downloadable
-- copy. GET /api/v1/reports/forms/:id/download 404s on a NULL pdf_content.
ALTER TABLE generated_forms ADD COLUMN IF NOT EXISTS pdf_content BYTEA NULL;

-- ── requisition_approvals ────────────────────────────────────
-- One row per approval decision — backs the approval-history view and the
-- multi-level / alternate-approver routing. Append-only by convention: a later
-- decision inserts a new row rather than updating an existing one.
-- SVC: Design & Transition — approval hierarchy and authorization control.
CREATE TABLE IF NOT EXISTS requisition_approvals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id  UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  approver_id     UUID NOT NULL REFERENCES users(id),
  action          VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected')),
  comments        TEXT,
  actioned_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisition_approvals_requisition
  ON requisition_approvals (requisition_id, actioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_requisition_approvals_approver
  ON requisition_approvals (approver_id);
