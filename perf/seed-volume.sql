-- ============================================================
-- AIMRS — Load-test data volume (LOCAL / throwaway DB ONLY)
-- Brings a fresh docker-compose Postgres up to roughly CICC scale
-- (~362 users, ~2,000 assets) so a load test measures real query
-- behaviour instead of framework overhead against an empty table.
--
--   docker exec -i aimrs_postgres psql -U aimrs_user -d aimrs_dev < perf/seed-volume.sql
--
-- All seeded rows are prefixed LT- / loaduser / PROP-LT- so they are
-- easy to identify and delete. NEVER run against Supabase or production.
-- ============================================================

-- ~360 extra users. Same bcrypt(12) hash as the dev seed => password
-- 'ChangeMe@1234!'. Mostly employees, some supervisors / IT personnel.
INSERT INTO users (
  employee_id, first_name, last_name, email, password_hash,
  role, division, office_or_section, is_active
)
SELECT
  'CICC-LT-' || LPAD(g::text, 5, '0'),
  'Load',
  'User' || g,
  'loaduser' || g || '@cicc.gov.ph',
  '$2b$12$eZJ/eWOpGS9KMskbB3sNleH9HGl9R9.ULPz/huLKo1XgBCdlUG136',
  (ARRAY['employee','employee','employee','employee','supervisor','it_personnel']::user_role[])[1 + (g % 6)],
  'Division ' || (1 + g % 32),
  'Section ' || (1 + g % 64),
  TRUE
FROM generate_series(1, 360) AS g
ON CONFLICT (employee_id) DO NOTHING;

-- ~2,000 assets across the real enum spread.
INSERT INTO assets (
  sap_classification, item_code, item_description, brand, serial_number,
  property_number, acquisition_cost, acquisition_date,
  division, office_or_section, office_location,
  condition, asset_class, asset_type, qr_code, barcode_value, status
)
SELECT
  'SAP-' || (g % 50),
  'ITM-' || (g % 200),
  'Load-test asset #' || g || ' — ' ||
    (ARRAY['Laptop','Monitor','Printer','Router','UPS','Scanner','Desktop','Server'])[1 + (g % 8)],
  (ARRAY['Dell','HP','Lenovo','Cisco','APC','Epson'])[1 + (g % 6)],
  'SN-LT-' || g,
  'PROP-LT-' || LPAD(g::text, 6, '0'),
  (5000 + (g % 100) * 1000)::numeric,
  CURRENT_DATE - (g % 900),
  'Division ' || (1 + g % 32),
  'Section ' || (1 + g % 64),
  'Building ' || (1 + g % 5) || ', Floor ' || (1 + g % 10),
  (ARRAY['serviceable','serviceable','serviceable','for_repair','unserviceable']::asset_condition[])[1 + (g % 5)],
  (ARRAY['PPE','SEP','IES']::asset_class[])[1 + (g % 3)],
  (ARRAY['ICT','Fixed','Supplies']::asset_type[])[1 + (g % 3)],
  'QR-LT-' || g,
  'BC-LT-' || g,
  (ARRAY['registered','available','available','issued','returned']::asset_status[])[1 + (g % 5)]
FROM generate_series(1, 2000) AS g
ON CONFLICT (property_number) DO NOTHING;

-- ~8,000 audit rows — audit_logs is the fastest-growing table in prod and
-- the audit-trail screen reads it.
INSERT INTO audit_logs (
  user_id, user_role, action, affected_record_id, affected_record_type,
  ip_address, "timestamp"
)
SELECT
  (SELECT id FROM users WHERE email = 'admin@cicc.gov.ph'),
  'system_admin',
  (ARRAY['user_login','asset_created','asset_updated','requisition_submitted','user_updated']::audit_action[])[1 + (g % 5)],
  (SELECT id FROM users WHERE email = 'admin@cicc.gov.ph'),
  'user',
  '10.10.' || (g % 255) || '.' || (1 + g % 254),
  NOW() - (g || ' minutes')::interval
FROM generate_series(1, 8000) AS g;

ANALYZE users;
ANALYZE assets;
ANALYZE audit_logs;

SELECT
  (SELECT count(*) FROM users)      AS users,
  (SELECT count(*) FROM assets)     AS assets,
  (SELECT count(*) FROM audit_logs) AS audit_logs;
