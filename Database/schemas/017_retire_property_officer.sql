-- 017_retire_property_officer.sql
-- The Property Officer role was a read-only subset of the Property Custodian (it
-- could see the registry, replacement validation, disposal review and the forms
-- archive, and file requisitions; the custodian can do all of that and more), so
-- the two roles were merged. Every account that held it becomes a Property
-- Custodian.
--
-- The 'property_officer' value STAYS in the user_role enum: Postgres cannot drop
-- an enum value, and audit_logs.user_role still carries it on old entries. The
-- application refuses to assign it (ASSIGNABLE_USER_ROLES in packages/shared) and no
-- route grants it.
--
-- token_version is bumped so each affected account's sessions are invalidated and
-- the next login picks up the new role and menu. updated_at is set by the table's
-- trigger. Idempotent: once no account holds the role, a re-run changes nothing.
-- No ALTER TYPE here, so it is safe inside a transaction.
-- synchronize:false — see CLAUDE.md §11#11.

UPDATE users
   SET role = 'property_custodian',
       token_version = token_version + 1
 WHERE role = 'property_officer';
