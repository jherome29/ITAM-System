-- 005_replacement_validation.sql
-- Replacement requisitions record which asset they replace (CLAUDE.md §17).
-- Run manually in the Supabase SQL editor (synchronize:false outside NODE_ENV=test).
--
-- Nullable, no FK — set only on requisitionType='replacement'. RequisitionsService
-- .create() validates, before the row is written, that the requester is the asset's
-- current custodian and that the asset meets a replacement criterion (condition no
-- longer 'serviceable', or age >= USEFUL_LIFE_YEARS for its class). No backfill:
-- existing replacement rows predate the field and simply leave it NULL.

ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS replaced_asset_id uuid;
