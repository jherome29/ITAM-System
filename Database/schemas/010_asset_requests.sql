-- 010_asset_requests.sql
-- Returns & Incidents: requests filed by the holder of an issued asset
-- (return, repair, damage, loss, theft) plus their photo/PDF attachments.
-- Backs AssetRequestEntity / AssetRequestAttachmentEntity.
--
-- Two-step flow: submitted → approved (custodian accepts, schedules hand-over)
-- → completed (item received / incident processed). rejected and cancelled are
-- terminal. Routed by asset type: ICT → IT Personnel, Fixed/Supplies →
-- Property Custodian.
--
-- Run manually, statement by statement in the Supabase SQL editor
-- (ALTER TYPE ... ADD VALUE is not valid inside a transaction block).
-- synchronize:false — see CLAUDE.md §11#11. Safe to re-run.
-- SVC: Deliver & Support — returns, repairs and incident reporting.

-- ── enum values ──────────────────────────────────────────────
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'asset_request_submitted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'asset_request_approved';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'asset_request_rejected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'asset_request_completed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'asset_request_cancelled';

ALTER TYPE notification_alert_type ADD VALUE IF NOT EXISTS 'asset_request';
ALTER TYPE notification_alert_type ADD VALUE IF NOT EXISTS 'asset_request_update';

-- ── asset_requests ───────────────────────────────────────────
-- type/status are VARCHAR + CHECK (same as requisition_approvals.action) rather
-- than native enums, so adding a value later needs no ALTER TYPE.
CREATE TABLE IF NOT EXISTS asset_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number      VARCHAR(20)  NOT NULL UNIQUE,
  asset_id            UUID         NOT NULL REFERENCES assets(id),
  requested_by_id     UUID         NOT NULL REFERENCES users(id),
  type                VARCHAR(10)  NOT NULL CHECK (type IN ('return', 'repair', 'damage', 'loss', 'theft')),
  status              VARCHAR(10)  NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'approved', 'completed', 'rejected', 'cancelled')),
  preferred_date      DATE         NOT NULL,
  details             TEXT         NOT NULL,
  handover_date       DATE,
  decided_by_id       UUID         REFERENCES users(id),
  decided_at          TIMESTAMP WITH TIME ZONE,
  decision_notes      TEXT,
  completed_by_id     UUID         REFERENCES users(id),
  completed_at        TIMESTAMP WITH TIME ZONE,
  completion_notes    TEXT,
  resulting_status    VARCHAR(30),
  cancelled_at        TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_requests_asset_status ON asset_requests (asset_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_requests_requester    ON asset_requests (requested_by_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_requests_status       ON asset_requests (status, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON asset_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON asset_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── asset_request_attachments ────────────────────────────────
-- Stored in-row as bytea like generated_forms.pdf_content (CLAUDE.md §11#10);
-- the entity marks `content` select:false so list queries never load it.
CREATE TABLE IF NOT EXISTS asset_request_attachments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id     UUID         NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
  file_name      VARCHAR(120) NOT NULL,
  mime_type      VARCHAR(50)  NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes     INTEGER      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  content        BYTEA        NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_request_attachments_request ON asset_request_attachments (request_id);
