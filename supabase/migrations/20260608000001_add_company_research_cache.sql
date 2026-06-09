-- Shared cache for AI-generated Research Company data.
-- Keyed by "<kind>:<normalized company>" where kind is 'profile' (hiring
-- values + benefits + financials — slow-moving) or 'news' (fast-moving). Splitting
-- by volatility lets the app reuse the expensive evergreen profile for weeks while
-- refreshing only news, and the shared table means popular companies are
-- researched once across ALL users instead of once per device. Treated as shared
-- reference data: any authenticated user may read; writes go through a controlled
-- security-definer RPC (no direct client INSERT/UPDATE), same as market_data_cache.
create table if not exists public.company_research_cache (
  cache_key text primary key,
  company text not null,
  kind text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_research_cache enable row level security;

-- Reads are open to authenticated users (shared reference data).
create policy company_research_cache_select on public.company_research_cache
  for select to authenticated using (true);
-- No INSERT/UPDATE policy on purpose — all writes go through the RPC below.

-- Controlled upsert. SECURITY DEFINER so it can write despite the absence of an
-- INSERT/UPDATE policy; validates shapes and caps sizes to prevent cache
-- poisoning / payload bloat.
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
  -- Cap the serialized payload at ~64 KB.
  if length(p_data::text) > 65536 then
    raise exception 'data too large';
  end if;

  insert into public.company_research_cache (cache_key, company, kind, data, updated_at)
  values (p_cache_key, p_company, p_kind, p_data, now())
  on conflict (cache_key) do update
    set company    = excluded.company,
        kind       = excluded.kind,
        data       = excluded.data,
        updated_at = now();
end;
$$;

revoke execute on function public.upsert_company_research_cache(text, text, text, jsonb) from anon;
grant  execute on function public.upsert_company_research_cache(text, text, text, jsonb) to authenticated;
