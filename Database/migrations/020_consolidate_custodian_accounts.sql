-- Run after the backend and frontend have deployed the combined workspace.
-- Keep legacy enum values for historical audit records and rollback.
UPDATE users
   SET role = 'asset_custodian',
       token_version = token_version + 1
 WHERE role IN ('it_personnel', 'property_custodian');
