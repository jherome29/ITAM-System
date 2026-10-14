-- 013_asset_repairs.sql
-- Repair records: one row per stay in `under_repair`. Opened automatically
-- when an asset enters under_repair (a completed repair / damage request, or a
-- custodian's lifecycle change) and closed when it leaves — repaired (back to
-- its holder, or into stock) or unrepairable (flagged for disposal). Backs
-- AssetRepairEntity.
--
-- Captures what the old Maintenance page never did: the reported problem, the
-- diagnosis, the action taken, in-house vs external service and by whom, and
-- the expected completion date the overdue-repair watcher alerts on.
-- No cost columns — financial tracking is out of scope (CLAUDE.md §11 #7-8).
--
-- Run manually, statement by statement in the Supabase SQL editor
-- (ALTER TYPE ... ADD VALUE is not valid inside a transaction block).
-- synchronize:false — see CLAUDE.md §11#11. Safe to re-run.
-- SVC: Deliver & Support — maintenance and repair; Improve — repair history.

-- ── enum values ──────────────────────────────────────────────
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'repair_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'repair_completed';

ALTER TYPE notification_alert_type ADD VALUE IF NOT EXISTS 'repair_update';
ALTER TYPE notification_alert_type ADD VALUE IF NOT EXISTS 'repair_overdue';

-- ── asset_repairs ────────────────────────────────────────────
-- service_type / outcome are VARCHAR + CHECK (like asset_requests) so a new
-- value needs no ALTER TYPE.
CREATE TABLE IF NOT EXISTS asset_repairs (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id                  UUID         NOT NULL REFERENCES assets(id),
  -- Who held it when it went in (null for a stock item) — the person the
  -- outcome is reported to and, when repaired, handed back to.
  holder_id                 UUID         REFERENCES users(id),
  asset_request_id          UUID         REFERENCES asset_requests(id),
  opened_by_id              UUID         NOT NULL REFERENCES users(id),
  opened_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reported_problem          TEXT,
  service_type              VARCHAR(10)  NOT NULL DEFAULT 'in_house'
                              CHECK (service_type IN ('in_house', 'external')),
  service_provider          VARCHAR(150),
  expected_completion_date  DATE,
  findings                  TEXT,
  action_taken              TEXT,
  outcome                   VARCHAR(15)  CHECK (outcome IN ('repaired', 'unrepairable')),
  completed_by_id           UUID         REFERENCES users(id),
  completed_at              TIMESTAMP WITH TIME ZONE,
  overdue_notified_at       TIMESTAMP WITH TIME ZONE,
  created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- At most one open repair per asset.
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_repairs_open
  ON asset_repairs (asset_id) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_asset_repairs_asset  ON asset_repairs (asset_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_repairs_open   ON asset_repairs (completed_at, opened_at);

DROP TRIGGER IF EXISTS set_updated_at ON asset_repairs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON asset_repairs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── backfill ─────────────────────────────────────────────────
-- Assets already under repair get an open record so they appear in the
-- Maintenance & Repair queue. The problem comes from the latest completed
-- repair/damage request, when there is one; the opener is whoever completed
-- it, else the most recent lifecycle actor, else any IT custodian / admin.
INSERT INTO asset_repairs (asset_id, holder_id, asset_request_id, opened_by_id, opened_at, reported_problem)
SELECT a.id,
       a.custodian_id,
       ar.id,
       COALESCE(
         ar.completed_by_id,
         (SELECT t.performed_by_id FROM asset_transactions t
            WHERE t.asset_id = a.id ORDER BY t."timestamp" DESC LIMIT 1),
         (SELECT u.id FROM users u
            WHERE u.role IN ('it_personnel', 'system_admin') ORDER BY u.created_at LIMIT 1)
       ),
       COALESCE(ar.completed_at, a.updated_at),
       ar.details
FROM assets a
LEFT JOIN LATERAL (
  SELECT r.* FROM asset_requests r
  WHERE r.asset_id = a.id AND r.status = 'completed' AND r.resulting_status = 'under_repair'
  ORDER BY r.completed_at DESC LIMIT 1
) ar ON TRUE
WHERE a.status = 'under_repair'
  AND NOT EXISTS (SELECT 1 FROM asset_repairs x WHERE x.asset_id = a.id AND x.completed_at IS NULL);

-- Condition now follows the repair lifecycle (AssetsService.conditionAfter);
-- items that went in before that still read "serviceable".
UPDATE assets SET condition = 'for_repair'
WHERE status = 'under_repair' AND condition = 'serviceable';
