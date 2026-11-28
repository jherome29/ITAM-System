-- 018_record_printouts.sql
-- A numbered paper copy of a requisition, a return / incident request or a repair, printed by whoever
-- acted on it (CICC asked for a hard copy after every step, as proof beyond the digital record).
-- Each print is stored as a generated form (form_type RECORD_PRINT, series PR-YYYY-NNNN, the existing
-- document_counters) and linked to the record it shows; a repair gets its own link, the other two
-- already have one. The verification code is printed on the paper so a copy can be checked against
-- the system. synchronize:false - see CLAUDE.md section 11 #11. Safe to re-run.

ALTER TABLE generated_forms
  ADD COLUMN IF NOT EXISTS related_asset_repair_id UUID REFERENCES asset_repairs(id);

ALTER TABLE generated_forms
  ADD COLUMN IF NOT EXISTS verification_code VARCHAR(12);

CREATE INDEX IF NOT EXISTS idx_generated_forms_asset_repair
  ON generated_forms (related_asset_repair_id);
