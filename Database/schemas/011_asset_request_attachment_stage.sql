-- 011_asset_request_attachment_stage.sql
-- Custodians can attach condition-on-receipt photos when marking a return /
-- repair / damage request received. `stage` separates those from the
-- requester's own evidence; `uploaded_by_id` records who attached the file.
-- Existing rows were all filed by the requester, hence the 'request' default.
-- synchronize:false — see CLAUDE.md §11#11. Safe to re-run.

ALTER TABLE asset_request_attachments
  ADD COLUMN IF NOT EXISTS stage VARCHAR(10) NOT NULL DEFAULT 'request';

ALTER TABLE asset_request_attachments
  DROP CONSTRAINT IF EXISTS asset_request_attachments_stage_check;
ALTER TABLE asset_request_attachments
  ADD CONSTRAINT asset_request_attachments_stage_check CHECK (stage IN ('request', 'receipt'));

ALTER TABLE asset_request_attachments
  ADD COLUMN IF NOT EXISTS uploaded_by_id UUID REFERENCES users(id);
