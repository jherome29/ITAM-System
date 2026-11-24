-- 015_function_search_path.sql
-- Pin the search_path of the two trigger functions in the public schema.
-- Supabase's security advisor flags a function with a role-mutable search_path
-- (lint 0011): the path is resolved from the CALLER's session, so anyone who
-- can create objects in an earlier schema could shadow what the function
-- resolves. Neither function is SECURITY DEFINER and neither references an
-- unqualified object (NOW() is pg_catalog, which is always searched first, and
-- prevent_audit_log_modification only RAISEs), so an empty search_path changes
-- no behaviour — it just removes the lookup.
--
--   update_updated_at_column()        keeps updated_at current on every table
--   prevent_audit_log_modification()  the trigger that makes audit_logs
--                                     append-only (CLAUDE.md 11 #3)
--
-- No schema change. Safe to re-run. SVC: Plan — security by design.

ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.prevent_audit_log_modification() SET search_path = '';
