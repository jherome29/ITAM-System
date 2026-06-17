-- ============================================================
-- AIMRS — Seed Data (Development Only)
-- DO NOT run in production.
-- ============================================================

-- Default System Administrator account (change password immediately after first login)
INSERT INTO users (
  id, employee_id, first_name, last_name, email, password_hash,
  role, division, office_or_section, is_active
) VALUES (
  uuid_generate_v4(),
  'CICC-ADMIN-001',
  'System',
  'Administrator',
  'admin@cicc.gov.ph',
  -- bcrypt hash of 'ChangeMe@1234!' — MUST be changed on first login
  '$2b$12$placeholder_hash_replace_before_use',
  'system_admin',
  'IT Division',
  'Systems Administration',
  TRUE
);

-- Sample IT Personnel
INSERT INTO users (
  id, employee_id, first_name, last_name, email, password_hash,
  role, division, office_or_section, is_active
) VALUES (
  uuid_generate_v4(),
  'CICC-IT-001',
  'Sample',
  'ITPersonnel',
  'it.personnel@cicc.gov.ph',
  '$2b$12$placeholder_hash_replace_before_use',
  'it_personnel',
  'IT Division',
  'IT Operations',
  TRUE
);
