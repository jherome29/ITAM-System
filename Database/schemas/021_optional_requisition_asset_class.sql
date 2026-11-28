-- Inventory determines the classification of an item entered manually on a requisition.
ALTER TABLE requisition_items ALTER COLUMN asset_class DROP NOT NULL;
