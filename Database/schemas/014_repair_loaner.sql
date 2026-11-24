-- 014_repair_loaner.sql
-- Loaner unit while an item is under repair. A custodian can lend the holder
-- an available unit of the same asset type from the repair record; it is
-- issued with an expected return date (so the overdue-return watcher covers
-- it) and linked here. When the repair closes, the holder is told to bring the
-- loaner back and its return date is brought forward to that day.
-- Backs AssetRepairEntity.loanerAssetId.
--
-- synchronize:false — see CLAUDE.md §11#11. Safe to re-run.
-- SVC: Deliver & Support — continuity of service during repair.

ALTER TABLE asset_repairs
  ADD COLUMN IF NOT EXISTS loaner_asset_id UUID REFERENCES assets(id);

CREATE INDEX IF NOT EXISTS idx_asset_repairs_loaner ON asset_repairs (loaner_asset_id);
