-- ============================================================
-- AIMRS — PostgreSQL Schema (apps/api internal reference)
-- Asset Inventory Management and Requisition System
-- For: Cybercrime Investigation and Coordinating Center (CICC)
--
-- Dev:  Supabase (managed PostgreSQL)
-- Prod: CICC-managed PostgreSQL (raw)
--
-- DO NOT use Supabase-specific client features.
-- All code must work on raw PostgreSQL in production.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUM TYPES ───────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'employee',       -- Service requester
  'supervisor',     -- First-level approver
  'it_personnel',   -- Asset custodian (primary operational role)
  'system_admin',   -- Full system access
  'management'      -- Read-only oversight
);

CREATE TYPE asset_class AS ENUM (
  'PPE',  -- Property, Plant & Equipment: useful life >1yr, cost >= PHP 50,000
  'SEP',  -- Semi-Expendable Property: useful life >1yr, cost < PHP 50,000
  'IES'   -- Inventory/Expendable Supplies: consumables, <1yr useful life
);

CREATE TYPE asset_type     AS ENUM ('ICT', 'Fixed', 'Supplies');
CREATE TYPE asset_condition AS ENUM ('serviceable', 'unserviceable', 'for_repair', 'for_disposal');
CREATE TYPE asset_status   AS ENUM (
  'registered', 'available', 'issued', 'returned',
  'transferred', 'under_repair', 'flagged_for_disposal', 'disposed'
);

CREATE TYPE requisition_status AS ENUM (
  'draft', 'submitted', 'pending_approval', 'approved', 'rejected',
  'pending_fulfillment', 'fulfilled', 'cancelled'
);

CREATE TYPE requisition_type AS ENUM ('new', 'replacement', 'repair', 'supply');

CREATE TYPE approval_action AS ENUM ('approved', 'rejected');

CREATE TYPE notification_alert_type AS ENUM (
  'low_stock', 'overdue_return', 'pending_approval', 'sla_breach', 'alternate_approver'
);

CREATE TYPE audit_action AS ENUM (
  -- Asset lifecycle
  'asset_created', 'asset_updated', 'asset_issued', 'asset_returned',
  'asset_transferred', 'asset_flagged_repair', 'asset_flagged_disposal',
  'asset_disposed', 'qr_generated',
  -- Requisition workflow
  'requisition_submitted', 'requisition_approved', 'requisition_rejected',
  'requisition_fulfilled', 'requisition_cancelled',
  -- Authentication
  'user_login', 'user_logout', 'user_login_failed', 'user_locked',
  -- Administration
  'user_created', 'user_updated', 'user_deactivated', 'role_assigned',
  -- Reporting
  'report_generated', 'form_generated'
);

-- ─── USERS ────────────────────────────────────────────────────
-- Data minimization per RA 10173 (Data Privacy Act):
-- Only fields required for asset assignment and account administration.
-- No HR data, no payroll, no leave records.

CREATE TABLE users (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       VARCHAR(50)  NOT NULL UNIQUE,
  -- Full name stored as first + last for official government form generation
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,          -- bcrypt, minimum 12 rounds
  role              user_role    NOT NULL,
  division          VARCHAR(100) NOT NULL,
  office_section    VARCHAR(100) NOT NULL,           -- Maps to officeOrSection in interface
  failed_login_attempts INT      DEFAULT 0,          -- Lockout after 5 failures
  locked_until      TIMESTAMP WITH TIME ZONE,
  is_active         BOOLEAN      DEFAULT TRUE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_users_role        ON users(role);
CREATE INDEX idx_users_division    ON users(division);

-- ─── ASSETS ───────────────────────────────────────────────────
-- All fields from the Asset interface (CLAUDE.md section 5.3)
-- Acquisition cost stored for identification only — NOT financial reporting

CREATE TABLE assets (
  id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- SAP / official classification
  sap_classification   VARCHAR(100),
  item_code            VARCHAR(100),
  item_description     TEXT         NOT NULL,
  brand                VARCHAR(100),
  serial_number        VARCHAR(100),
  property_number      VARCHAR(100) UNIQUE,          -- Official CICC property number
  components           TEXT,                          -- Attached accessories/components
  -- Financial identification (not accounting)
  acquisition_cost     NUMERIC(12,2) DEFAULT 0,       -- PHP value — ID purposes only
  acquisition_date     DATE,
  -- Accountability
  accountable_officer  VARCHAR(200),                  -- Name of accountable officer
  division             VARCHAR(100),
  office_or_section    VARCHAR(100),
  office_location      VARCHAR(200),
  -- Condition & classification
  condition            asset_condition NOT NULL DEFAULT 'serviceable',
  supplier             VARCHAR(200),
  date_of_delivery     DATE,
  asset_class          asset_class    NOT NULL,        -- PPE | SEP | IES
  asset_type           asset_type     NOT NULL,        -- ICT | Fixed | Supplies
  -- System-generated identifiers
  qr_code              VARCHAR(255)   UNIQUE,          -- Auto-generated QR identifier
  barcode_value        VARCHAR(255)   UNIQUE,          -- Auto-generated barcode
  -- Lifecycle
  status               asset_status   NOT NULL DEFAULT 'registered',
  custodian_id         UUID           REFERENCES users(id) ON DELETE SET NULL,
  -- Timestamps
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assets_status          ON assets(status);
CREATE INDEX idx_assets_asset_class     ON assets(asset_class);
CREATE INDEX idx_assets_asset_type      ON assets(asset_type);
CREATE INDEX idx_assets_custodian_id    ON assets(custodian_id);
CREATE INDEX idx_assets_property_number ON assets(property_number);
CREATE INDEX idx_assets_condition       ON assets(condition);

-- Asset movement/transaction history
CREATE TABLE asset_transactions (
  id              UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID  NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  action          audit_action NOT NULL,
  performed_by_id UUID  NOT NULL REFERENCES users(id),
  from_location   VARCHAR(200),
  to_location     VARCHAR(200),
  notes           TEXT,
  timestamp       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_asset_tx_asset_id  ON asset_transactions(asset_id);
CREATE INDEX idx_asset_tx_timestamp ON asset_transactions(timestamp);

-- ─── REQUISITIONS ─────────────────────────────────────────────
-- SVC: Engage — employee requests routed through supervisor to IT Personnel

CREATE TABLE requisitions (
  id               UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number   VARCHAR(50)        NOT NULL UNIQUE,   -- e.g. REQ-2026-0001
  requester_id     UUID               NOT NULL REFERENCES users(id),
  requisition_type requisition_type   NOT NULL,
  status           requisition_status NOT NULL DEFAULT 'draft',
  justification    TEXT               NOT NULL,
  required_date    DATE               NOT NULL,
  asset_type       asset_type,                            -- Primary asset type requested
  quantity         INT                NOT NULL DEFAULT 1,
  -- SLA tracking: 24-hour approval turnaround target
  submitted_at     TIMESTAMP WITH TIME ZONE,
  sla_deadline     TIMESTAMP WITH TIME ZONE,              -- submitted_at + 24h
  -- Fulfillment
  it_personnel_id  UUID               REFERENCES users(id),
  fulfilled_at     TIMESTAMP WITH TIME ZONE,
  fulfillment_notes TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_req_status       ON requisitions(status);
CREATE INDEX idx_req_requester    ON requisitions(requester_id);
CREATE INDEX idx_req_sla_deadline ON requisitions(sla_deadline);

-- Requisition line items
CREATE TABLE requisition_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id     UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  asset_type         asset_type  NOT NULL,
  asset_class        asset_class NOT NULL,
  item_description   TEXT        NOT NULL,
  quantity           INT         NOT NULL DEFAULT 1,
  justification      TEXT,
  fulfilled_asset_id UUID        REFERENCES assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_req_items_req_id ON requisition_items(requisition_id);

-- ─── REQUISITION APPROVALS ────────────────────────────────────
-- Separate approval tracking per decision step.
-- Supports multi-level approval and alternate approver designation.

CREATE TABLE requisition_approvals (
  id             UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID            NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  approver_id    UUID            NOT NULL REFERENCES users(id),
  action         approval_action NOT NULL,   -- 'approved' | 'rejected'
  comments       TEXT,                        -- Required on rejection
  actioned_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_approvals_requisition_id ON requisition_approvals(requisition_id);
CREATE INDEX idx_approvals_approver_id    ON requisition_approvals(approver_id);
CREATE INDEX idx_approvals_actioned_at    ON requisition_approvals(actioned_at);

-- ─── AUDIT LOGS ───────────────────────────────────────────────
-- ⚠️  COA COMPLIANCE REQUIREMENT — APPEND-ONLY TABLE ⚠️
--
-- This table must NEVER have UPDATE or DELETE operations performed on it.
-- Reason: Commission on Audit (COA) documentation requires an immutable,
-- tamper-proof audit trail for all government system transactions.
-- Also required by RA 10173 (Data Privacy Act) audit accountability provisions.
--
-- Implementation:
--   1. No UPDATE or DELETE endpoints exist in the AuditService or AuditController.
--   2. REVOKE UPDATE, DELETE ON audit_logs FROM <app_db_user>; (run as superuser)
--   3. The AuditLogEntity has no @UpdateDateColumn — timestamp is set once on INSERT.
--
-- Violation of this constraint is a capstone-level blocker and a legal compliance failure.

CREATE TABLE audit_logs (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID         NOT NULL,              -- No FK: log survives user deactivation
  user_role         user_role    NOT NULL,              -- Snapshot at time of action
  action_type       audit_action NOT NULL,              -- What happened
  record_id         UUID         NOT NULL,              -- Which record was affected
  record_table      VARCHAR(50)  NOT NULL,              -- 'assets' | 'requisitions' | 'users' | etc.
  ip_address        VARCHAR(45)  NOT NULL,              -- IPv4 or IPv6
  user_agent        TEXT,
  metadata          JSONB,                               -- Additional context (no sensitive data)
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- Set ONCE on INSERT, never changed
  -- ← NO updated_at column. Intentional.
);

-- IMPORTANT: Run this as superuser after creating the DB role:
-- REVOKE UPDATE, DELETE ON audit_logs FROM aimrs_app_user;
-- GRANT SELECT, INSERT ON audit_logs TO aimrs_app_user;

CREATE INDEX idx_audit_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_action     ON audit_logs(action_type);
CREATE INDEX idx_audit_record     ON audit_logs(record_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
-- SVC: Engage — in-system alerts for all 5 roles

CREATE TABLE notifications (
  id                  UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id        UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                notification_alert_type NOT NULL,
  message             TEXT                    NOT NULL,
  related_record_id   UUID,
  related_record_type VARCHAR(50),
  is_read             BOOLEAN                 DEFAULT FALSE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notif_is_read      ON notifications(is_read);
CREATE INDEX idx_notif_created_at   ON notifications(created_at);

-- ─── GENERATED REPORTS & FORMS ────────────────────────────────

CREATE TABLE generated_reports (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_by_id UUID        NOT NULL REFERENCES users(id),
  report_type     VARCHAR(100) NOT NULL,
  format          VARCHAR(10)  NOT NULL CHECK (format IN ('PDF', 'Excel')),
  file_path       VARCHAR(500) NOT NULL,
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COA official forms (PAR, ICS, RIS, PTR, etc.)
-- Digital copies retained; physical signatures done manually per COA procedure.
CREATE TABLE generated_forms (
  id                     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_type              VARCHAR(50)  NOT NULL,
  generated_by_id        UUID         NOT NULL REFERENCES users(id),
  related_asset_id       UUID         REFERENCES assets(id) ON DELETE SET NULL,
  related_requisition_id UUID         REFERENCES requisitions(id) ON DELETE SET NULL,
  file_path              VARCHAR(500) NOT NULL,
  generated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── AUTO-UPDATE TRIGGERS ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_requisitions_updated_at
  BEFORE UPDATE ON requisitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
