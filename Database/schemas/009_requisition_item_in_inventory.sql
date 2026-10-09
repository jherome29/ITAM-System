-- 009_requisition_item_in_inventory.sql
-- Requisition item picker: each requisition line records whether it matched an
-- available inventory item at submission (RequisitionItemEntity.inInventory).
-- Lines typed in through the "Can't find it?" fallback store false, which the
-- custodian fulfillment queue shows as "Not in inventory".
--
-- Server-computed in RequisitionsService.create() — never client-supplied.
-- Existing rows default to false (unknown at the time they were submitted).
-- synchronize:false — see CLAUDE.md §11#11. Safe to re-run.

ALTER TABLE requisition_items
  ADD COLUMN IF NOT EXISTS in_inventory boolean NOT NULL DEFAULT false;
