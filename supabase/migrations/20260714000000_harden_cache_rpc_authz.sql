-- ─────────────────────────────────────────────────────────
-- Harden upsert_market_data_cache / upsert_company_research_cache
-- ─────────────────────────────────────────────────────────
-- Both RPCs are SECURITY DEFINER and granted to `authenticated` with no
-- per-caller relationship check — any signed-up user can call them directly
-- (bypassing the app UI) with an arbitrary cache_key and fabricated `data`,
-- which is then served to EVERY user who looks up that key (both tables are
-- shared reference data, read-open to `authenticated`). That's an
-- authorization gap: the functions validate payload *shape/size* but not
-- *who* is writing or *how often*, so a single account can poison an
-- unbounded number of shared rows with misinformation.
--
-- This migration doesn't change the read-open design (that's intentional —
-- it's a shared cache) but closes the two things that made abuse cheap and
-- untraceable:
--   1. Per-user rate limiting on writes, so one account can't rewrite the
--      whole cache in a script.
--   2. Write attribution (`last_written_by`), so a poisoned row can be
--      traced to the writing account and cleaned up / the account banned.
--   3. A structural sanity check on `data` (non-empty `locations` array for
--      market data) to reject obviously-malformed payloads, on top of the
--      existing size/type checks.
--
-- cache_write_rate_limits mirrors ai_rate_limits (20260624000003): accessed
-- only via the SECURITY DEFINER function below, so — per the grants
-- convention in supabase/pending_migrations/README.md — it deliberately gets
-- no direct grant to authenticated/service_role.

-- 1. Shared per-user rate-limit counters for these two RPCs.
create table if not exists public.cache_write_rate_limits (
  user_id    uuid not null,
  scope      text not null, -- 'market_data' | 'company_research'
  window_key bigint not null, -- floor(epoch seconds / 3600): 1-hour buckets
  hit_count  int not null default 1,
  primary key (user_id, scope, window_key)
);

alter table public.cache_write_rate_limits enable row level security;
-- No policies: only ever touched via the SECURITY DEFINER function below.

create or replace function public.check_cache_write_rate_limit(
  p_scope    text,
  p_max_hits int
) returns boolean -- true if OVER the limit (caller should reject)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count      int;
  v_window_key bigint := floor(extract(epoch from now()) / 3600);
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.cache_write_rate_limits (user_id, scope, window_key, hit_count)
  values (auth.uid(), p_scope, v_window_key, 1)
  on conflict (user_id, scope, window_key)
    do update set hit_count = cache_write_rate_limits.hit_count + 1
  returning hit_count into v_count;

  return v_count > p_max_hits;
end;
$$;

revoke all on function public.check_cache_write_rate_limit(text, int) from public;
revoke all on function public.check_cache_write_rate_limit(text, int) from authenticated;
revoke all on function public.check_cache_write_rate_limit(text, int) from anon;

-- 2. Attribution column on both cache tables.
alter table public.market_data_cache
  add column if not exists last_written_by uuid references auth.users(id) on delete set null;
alter table public.company_research_cache
  add column if not exists last_written_by uuid references auth.users(id) on delete set null;

-- 3. Re-create both upsert RPCs with rate limiting + attribution + a
--    structural sanity check on the payload.

create or replace function public.upsert_market_data_cache(
  p_cache_key          text,
  p_role               text,
  p_location           text,
  p_secondary_location text,
  p_yoe_tier           text,
  p_data               jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  -- Existing shape/size validation.
  if p_cache_key is null or length(p_cache_key) = 0 or length(p_cache_key) > 512 then
    raise exception 'invalid cache_key';
  end if;
  if p_role is null or length(p_role) > 256 then
    raise exception 'invalid role';
  end if;
  if p_location is null or length(p_location) > 256 then
    raise exception 'invalid location';
  end if;
  if p_secondary_location is not null and length(p_secondary_location) > 256 then
    raise exception 'invalid secondary_location';
  end if;
  if p_yoe_tier is null or length(p_yoe_tier) > 32 then
    raise exception 'invalid yoe_tier';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'data must be a JSON object';
  end if;
  if length(p_data::text) > 65536 then
    raise exception 'data too large';
  end if;
  -- Structural sanity: a real market-data result always has a non-empty
  -- locations array — rejects trivially-malformed/defacement payloads.
  if jsonb_typeof(p_data->'locations') <> 'array' or jsonb_array_length(p_data->'locations') = 0 then
    raise exception 'data.locations must be a non-empty array';
  end if;

  -- Rate limit: at most 20 writes/hour/user across cache keys.
  if public.check_cache_write_rate_limit('market_data', 20) then
    raise exception 'rate limit exceeded';
  end if;

  insert into public.market_data_cache
    (cache_key, role, location, secondary_location, yoe_tier, data, updated_at, last_written_by)
  values
    (p_cache_key, p_role, p_location, p_secondary_location, p_yoe_tier, p_data, now(), auth.uid())
  on conflict (cache_key) do update
    set role               = excluded.role,
        location           = excluded.location,
        secondary_location = excluded.secondary_location,
        yoe_tier           = excluded.yoe_tier,
        data               = excluded.data,
        updated_at         = now(),
        last_written_by    = excluded.last_written_by;
end;
$$;

revoke execute on function public.upsert_market_data_cache(text, text, text, text, text, jsonb) from anon;
grant  execute on function public.upsert_market_data_cache(text, text, text, text, text, jsonb) to authenticated;

create or replace function public.upsert_company_research_cache(
  p_cache_key text,
  p_company   text,
  p_kind      text,
  p_data      jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_cache_key is null or length(p_cache_key) = 0 or length(p_cache_key) > 512 then
    raise exception 'invalid cache_key';
  end if;
  if p_company is null or length(p_company) = 0 or length(p_company) > 256 then
    raise exception 'invalid company';
  end if;
  if p_kind is null or p_kind not in ('profile', 'news') then
    raise exception 'invalid kind';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'data must be a JSON object';
  end if;
  if length(p_data::text) > 65536 then
    raise exception 'data too large';
  end if;

  -- Rate limit: at most 20 writes/hour/user across cache keys.
  if public.check_cache_write_rate_limit('company_research', 20) then
    raise exception 'rate limit exceeded';
  end if;

  insert into public.company_research_cache (cache_key, company, kind, data, updated_at, last_written_by)
  values (p_cache_key, p_company, p_kind, p_data, now(), auth.uid())
  on conflict (cache_key) do update
    set company         = excluded.company,
        kind            = excluded.kind,
        data            = excluded.data,
        updated_at      = now(),
        last_written_by = excluded.last_written_by;
end;
$$;

revoke execute on function public.upsert_company_research_cache(text, text, text, jsonb) from anon;
grant  execute on function public.upsert_company_research_cache(text, text, text, jsonb) to authenticated;
