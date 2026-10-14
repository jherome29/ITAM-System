-- 012_generated_form_asset_request.sql
-- Links a generated COA form to the Returns & Incidents request it documents
-- (Receipt of Returned Property/SEP, RLSDDP, IIRUP). These forms are generated
-- automatically when a custodian completes the request, and the requester may
-- download them from that request as their proof of return / incident report.
-- synchronize:false — see CLAUDE.md §11#11. Safe to re-run.

ALTER TABLE generated_forms
  ADD COLUMN IF NOT EXISTS related_asset_request_id UUID REFERENCES asset_requests(id);

CREATE INDEX IF NOT EXISTS idx_generated_forms_asset_request
  ON generated_forms (related_asset_request_id);
