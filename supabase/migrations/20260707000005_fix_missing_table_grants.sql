-- PRODUCTION BUGFIX — apply ASAP, independent of Coach OS F1 Slice B.
--
-- Discovered 2026-07-08: `profiles` (and 10 other tables) were missing base
-- table-level GRANTs for `authenticated` (and, for some, `service_role`),
-- causing "Grant the required privileges..." errors in the live app (e.g.
-- profile save) and silently broken cron functions (`refresh-suggestions`,
-- `generate-nudges` — see 20260707000004_job_postings_grants.sql for the
-- job_postings case, filed separately).
--
-- No migration in this repo ever issued a table-level REVOKE — grep across
-- supabase/migrations/*.sql for "revoke" turns up only function-level
-- revokes (check_ai_rate_limit, check_ai_usage_cap, upsert_*_cache from
-- anon). So this wasn't caused by a migration; it happened outside of
-- version control (Dashboard/SQL editor). Confirmed via:
--   select t.tablename, bool_or(g.privilege_type = 'SELECT') as has_select
--   from pg_tables t
--   left join information_schema.role_table_grants g
--     on g.table_name = t.tablename and g.table_schema = 'public'
--    and g.grantee = 'authenticated'
--   where t.schemaname = 'public'
--   group by t.tablename
--   having not bool_or(g.privilege_type = 'SELECT');
--
-- `ai_rate_limits` also showed up in that audit but is EXCLUDED here on
-- purpose: it's accessed only via the SECURITY DEFINER
-- `check_ai_rate_limit()` function (execute revoked from authenticated/
-- public, granted only to service_role) — no direct table grant is meant to
-- exist for either role, so its absence is correct, not a bug.
--
-- `admin_audit_log` is a SEPARATE, genuine authoring bug (not the
-- outside-of-migrations drift the rest of this file addresses):
-- 20260624000004_add_admin_audit_log.sql's own trailing comment says
-- "service_role for admin tooling" but the grant statement below it only
-- ever granted `authenticated` — the service_role grant was never written.
-- Folded in here rather than filed as its own migration since it's the same
-- audit pass and hasn't shipped yet.
--
-- Grants below match each table's existing RLS policy operations exactly
-- (see the migration that created each table for the policy list) — so a
-- role never gets a table-level privilege it has no RLS policy to use.
-- service_role gets `all privileges` uniformly, matching the convention
-- used everywhere else in this schema (e.g. company_profiles,
-- ai_conversations, user_memories, coach_nudges) — it already bypasses RLS,
-- so this only restores standard admin/service access, not a security change.

-- ai_usage — select-only for authenticated (owner read); service_role inserts
-- via the ai-gateway metering path.
grant select on table public.ai_usage to authenticated;
grant all privileges on table public.ai_usage to service_role;

-- application_packages — full owner CRUD.
grant select, insert, update, delete on table public.application_packages to authenticated;
grant all privileges on table public.application_packages to service_role;

-- company_research_cache — select-only for authenticated; writes go through
-- the SECURITY DEFINER upsert_company_research_cache() RPC, not direct insert.
grant select on table public.company_research_cache to authenticated;
grant all privileges on table public.company_research_cache to service_role;

-- interview_sessions — owner select/insert/delete (no update policy exists).
grant select, insert, delete on table public.interview_sessions to authenticated;
grant all privileges on table public.interview_sessions to service_role;

-- market_data_cache — shared cache: authenticated select/insert/update
-- (using(true)/with check(true) — any signed-in user can populate it, no
-- delete policy exists).
grant select, insert, update on table public.market_data_cache to authenticated;
grant all privileges on table public.market_data_cache to service_role;

-- negotiation_sessions — owner select/insert/delete (no update policy exists).
grant select, insert, delete on table public.negotiation_sessions to authenticated;
grant all privileges on table public.negotiation_sessions to service_role;

-- outreach_contacts — full owner CRUD.
grant select, insert, update, delete on table public.outreach_contacts to authenticated;
grant all privileges on table public.outreach_contacts to service_role;

-- profiles — owner select/insert/update (no delete policy — users don't
-- delete their own profile row directly). THE LIVE-BROKEN TABLE.
grant select, insert, update on table public.profiles to authenticated;
grant all privileges on table public.profiles to service_role;

-- resume_analysis_cache — full owner CRUD (per-user cache, not shared).
grant select, insert, update, delete on table public.resume_analysis_cache to authenticated;
grant all privileges on table public.resume_analysis_cache to service_role;

-- saved_analyses — owner select/insert/delete (no update policy exists).
grant select, insert, delete on table public.saved_analyses to authenticated;
grant all privileges on table public.saved_analyses to service_role;

-- admin_audit_log — authenticated already has select (RLS gates it to
-- admins via current_user_is_admin()); service_role's grant was simply
-- never written despite the migration's own comment promising it.
grant select on table public.admin_audit_log to service_role;
