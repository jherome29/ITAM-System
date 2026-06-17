-- ============================================================
-- AIMRS — Database Schema
-- Asset Inventory Management and Requisition System
-- For: CICC (Cybercrime Investigation and Coordinating Center)
-- Dev: Supabase (managed PostgreSQL)
-- Prod: CICC-managed PostgreSQL (MySQL as fallback)
-- ============================================================
-- IMPORTANT: Run migrations in order. Do NOT modify existing
-- migration files — create new ones for changes.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUM TYPES ───────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'employee', 'supervisor', 'it_personnel', 'system_admin', 'management'
);

CREATE TYPE asset_class AS ENUM ('PPE', 'SEP', 'IES');
CREATE TYPE asset_type AS ENUM ('ICT', 'Fixed', 'Supplies');
CREATE TYPE asset_condition AS ENUM (
  'serviceable', 'unserviceable', 'for_repair', 'for_disposal'
);
CREATE TYPE asset_status AS ENUM (
  'registered', 'available', 'issued', 'returned',
  'transferred', 'under_repair', 'flagged_for_disposal', 'disposed'
);
CREATE TYPE requisition_status AS ENUM (
  'draft', 'submitted', 'pending_approval', 'approved', 'rejected',
  'pending_fulfillment', 'fulfilled', 'cancelled'
);
CREATE TYPE requisition_type AS ENUM ('new', 'replacement', 'repair', 'supply');
CREATE TYPE notification_alert_type AS ENUM (
  'low_stock', 'overdue_return', 'pending_approval', 'sla_breach', 'alternate_approver'
);
CREATE TYPE audit_action AS ENUM (
  'asset_created', 'asset_updated', 'asset_issued', 'asset_returned',
  'asset_transferred', 'asset_flagged_repair', 'asset_flagged_disposal',
  'asset_disposed', 'qr_generated',
  'requisition_submitted', 'requisition_approved', 'requisition_rejected',
  'requisition_fulfilled', 'requisition_cancelled',
  'user_login', 'user_logout', 'user_login_failed', 'user_locked',
  'user_created', 'user_updated', 'user_deactivated', 'role_assigned',
  'report_generated', 'form_generated'
);

-- ─── USERS ────────────────────────────────────────────────────
-- Data minimization: employee ID, name, email, division, section, role only.
-- No HR data, no payroll, no leave records. (RA 10173 compliance)

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id      VARCHAR(50)  NOT NULL UNIQUE,
  first_name       VARCHAR(100) NOT NULL,
  last_name        VARCHAR(100) NOT NULL,
  email            VARCHAR(255) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,   -- bcrypt, min 12 rounds
  role             user_role    NOT NULL,
  division         VARCHAR(100) NOT NULL,
  office_or_section VARCHAR(100) NOT NULL,
  failed_login_attempts INT DEFAULT 0,      -- lockout tracking
  locked_until     TIMESTAMP WITH TIME ZONE,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ─── ASSETS ───────────────────────────────────────────────────

CREATE TABLE assets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sap_classification  VARCHAR(100),
  item_code           VARCHAR(100),
  item_description    TEXT NOT NULL,
  brand               VARCHAR(100),
  serial_number       VARCHAR(100),
  property_number     VARCHAR(100) UNIQUE,  -- Official CICC property number
  components          TEXT,                 -- Attached components/accessories
  acquisition_cost    NUMERIC(12,2) DEFAULT 0, -- ₱ — identification only
  acquisition_date    DATE,
  accountable_officer VARCHAR(200),
  division            VARCHAR(100),
  office_or_section   VARCHAR(100),
  office_location     VARCHAR(200),
  condition           asset_condition NOT NULL DEFAULT 'serviceable',
  supplier            VARCHAR(200),
  date_of_delivery    DATE,
  asset_class         asset_class NOT NULL,
  asset_type          asset_type NOT NULL,
  qr_code             VARCHAR(255) UNIQUE,  -- System-generated
  barcode_value       VARCHAR(255) UNIQUE,  -- System-generated
  status              asset_status NOT NULL DEFAULT 'registered',
  custodian_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_asset_class ON assets(asset_class);
CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_custodian_id ON assets(custodian_id);
CREATE INDEX idx_assets_property_number ON assets(property_number);

-- ─── ASSET TRANSACTIONS ───────────────────────────────────────

CREATE TABLE asset_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  action          audit_action NOT NULL,
  performed_by_id UUID NOT NULL REFERENCES users(id),
  from_location   VARCHAR(200),
  to_location     VARCHAR(200),
  notes           TEXT,
  timestamp       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_asset_transactions_asset_id ON asset_transactions(asset_id);
CREATE INDEX idx_asset_transactions_timestamp ON asset_transactions(timestamp);

-- ─── REQUISITIONS ─────────────────────────────────────────────

CREATE TABLE requisitions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number        VARCHAR(50) NOT NULL UNIQUE, -- e.g. REQ-2026-0001
  requested_by_id       UUID NOT NULL REFERENCES users(id),
  requisition_type      requisition_type NOT NULL,
  status                requisition_status NOT NULL DEFAULT 'draft',
  justification         TEXT NOT NULL,
  required_date         DATE NOT NULL,
  -- Approval
  supervisor_id         UUID REFERENCES users(id),
  supervisor_decision   VARCHAR(20) CHECK (supervisor_decision IN ('approved','rejected')),
  supervisor_comments   TEXT,
  supervisor_decided_at TIMESTAMP WITH TIME ZONE,
  -- Fulfillment
  it_personnel_id       UUID REFERENCES users(id),
  fulfilled_at          TIMESTAMP WITH TIME ZONE,
  fulfillment_notes     TEXT,
  -- SLA tracking (24-hour target)
  submitted_at          TIMESTAMP WITH TIME ZONE,
  sla_deadline          TIMESTAMP WITH TIME ZONE,  -- submitted_at + 24h
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_requisitions_requested_by ON requisitions(requested_by_id);
CREATE INDEX idx_requisitions_supervisor ON requisitions(supervisor_id);
CREATE INDEX idx_requisitions_sla ON requisitions(sla_deadline);

-- ─── REQUISITION ITEMS ────────────────────────────────────────

CREATE TABLE requisition_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id      UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  asset_type          asset_type NOT NULL,
  asset_class         asset_class NOT NULL,
  item_description    TEXT NOT NULL,
  quantity            INT NOT NULL DEFAULT 1,
  justification       TEXT,
  fulfilled_asset_id  UUID REFERENCES assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_req_items_requisition_id ON requisition_items(requisition_id);

-- ─── AUDIT LOGS ───────────────────────────────────────────────
-- APPEND-ONLY: No UPDATE or DELETE ever. COA compliance requirement.
-- Revoke UPDATE and DELETE privileges at DB level for extra protection.

CREATE TABLE audit_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL,          -- No FK: log must survive user deletion
  user_role            user_role NOT NULL,     -- Snapshot at time of action
  action               audit_action NOT NULL,
  affected_record_id   UUID NOT NULL,
  affected_record_type VARCHAR(50) NOT NULL,   -- 'asset' | 'requisition' | 'user' | 'report'
  ip_address           VARCHAR(45) NOT NULL,   -- IPv4 or IPv6
  user_agent           TEXT,
  metadata             JSONB,                  -- Extra context, no sensitive data
  timestamp            TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Set once, never changed
);

-- Revoke dangerous privileges on audit_logs (run as superuser)
-- REVOKE UPDATE, DELETE ON audit_logs FROM aimrs_app_user;

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_affected_record ON audit_logs(affected_record_id);

-- ─── NOTIFICATIONS ────────────────────────────────────────────

CREATE TABLE notifications (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type           notification_alert_type NOT NULL,
  title                VARCHAR(255) NOT NULL,
  message              TEXT NOT NULL,
  related_record_id    UUID,
  related_record_type  VARCHAR(50),
  is_read              BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ─── GENERATED REPORTS ────────────────────────────────────────

CREATE TABLE generated_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_by_id  UUID NOT NULL REFERENCES users(id),
  report_type      VARCHAR(100) NOT NULL,
  format           VARCHAR(10) NOT NULL CHECK (format IN ('PDF', 'Excel')),
  file_path        VARCHAR(500) NOT NULL,
  generated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── GENERATED FORMS (COA Official Forms) ─────────────────────

CREATE TABLE generated_forms (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_type               VARCHAR(50) NOT NULL,  -- OfficialFormType enum value
  generated_by_id         UUID NOT NULL REFERENCES users(id),
  related_asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
  related_requisition_id  UUID REFERENCES requisitions(id) ON DELETE SET NULL,
  file_path               VARCHAR(500) NOT NULL,
  generated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON requisitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
