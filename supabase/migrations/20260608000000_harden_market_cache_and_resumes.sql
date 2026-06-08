-- ─────────────────────────────────────────────────────────
-- Hardening: lock down market_data_cache writes + constrain the resumes bucket
-- ─────────────────────────────────────────────────────────

-- 1. market_data_cache
-- ----------------------------------------------------------
-- The previous policies let any authenticated user INSERT/UPDATE any cache row
-- with arbitrary `data`, which is then served to every other user (cache
-- poisoning / cross-user data injection). Replace direct client writes with a
-- single security-definer RPC that validates inputs and bounds the payload.
-- Reads stay open (shared reference data).

drop policy if exists market_cache_insert on public.market_data_cache;
drop policy if exists market_cache_update on public.market_data_cache;
-- Keep the existing SELECT policy (any authenticated user may read).

-- Controlled upsert. SECURITY DEFINER so it can write despite the absence of an
-- INSERT/UPDATE policy; validates shapes and caps sizes to prevent abuse.
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
  -- Basic input validation / bounds (defense against junk + bloat).
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
  -- Cap the serialized payload at ~64 KB.
  if length(p_data::text) > 65536 then
    raise exception 'data too large';
  end if;

  insert into public.market_data_cache
    (cache_key, role, location, secondary_location, yoe_tier, data, updated_at)
  values
    (p_cache_key, p_role, p_location, p_secondary_location, p_yoe_tier, p_data, now())
  on conflict (cache_key) do update
    set role               = excluded.role,
        location           = excluded.location,
        secondary_location = excluded.secondary_location,
        yoe_tier           = excluded.yoe_tier,
        data               = excluded.data,
        updated_at         = now();
end;
$$;

revoke execute on function public.upsert_market_data_cache(text, text, text, text, text, jsonb) from anon;
grant  execute on function public.upsert_market_data_cache(text, text, text, text, text, jsonb) to authenticated;

-- 2. resumes storage bucket
-- ----------------------------------------------------------
-- The bucket was created with only `public = false`; add a size cap and a MIME
-- allowlist so it can't be abused for arbitrary large/binary uploads. The app
-- only ever stores small markdown/plain-text resume payloads.
update storage.buckets
  set file_size_limit  = 5242880,  -- 5 MB per file
      allowed_mime_types = array['text/plain', 'text/markdown']
  where id = 'resumes';
