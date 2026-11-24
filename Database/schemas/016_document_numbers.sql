-- 016_document_numbers.sql
-- Real running numbers for the per-transaction COA forms (PAR, ICS, PTR, IAR,
-- Receipt of Returned Property/SEP, RLSDDP, Move-Out).
--
-- Until now those numbers were made up when the PDF was drawn (the property
-- number as the PAR No., "ICS-" + property number, "RRSP-" + the clock), so two
-- forms could carry the same number and a re-download could differ. A form now
-- takes the next value of its series for the year, inside the transaction that
-- stores it, and keeps it: generated_forms.document_number.
--
--   document_counters  one row per (series, year); incremented with an atomic
--                      INSERT ... ON CONFLICT DO UPDATE ... RETURNING
--   generated_forms.document_number  e.g. PAR-2026-0007; NULL for forms that
--                      are not numbered per transaction and for rows generated
--                      before this migration (their PDFs are unchanged)
--
-- The format <SERIES>-<YYYY>-<NNNN> is a placeholder until CICC's property
-- office confirms its own series; changing it needs no schema change.
-- synchronize:false - see CLAUDE.md 11#11. Safe to re-run.

CREATE TABLE IF NOT EXISTS document_counters (
  series      TEXT    NOT NULL,
  year        INTEGER NOT NULL,
  last_value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (series, year)
);

ALTER TABLE generated_forms
  ADD COLUMN IF NOT EXISTS document_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_generated_forms_document_number
  ON generated_forms (document_number)
  WHERE document_number IS NOT NULL;
