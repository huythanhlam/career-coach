-- Distributed rate limit counters for the ai-generate Edge Function.
-- Replaces the in-memory Map that resets on every cold start, allowing
-- the limit to be enforced globally across all function instances.

create table if not exists public.ai_rate_limits (
  user_id    uuid    not null,
  window_key bigint  not null,
  hit_count  int     not null default 1,
  primary key (user_id, window_key)
);

alter table public.ai_rate_limits enable row level security;

create or replace function public.check_ai_rate_limit(
  p_user_id    uuid,
  p_window_key bigint,
  p_max_hits   int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.ai_rate_limits (user_id, window_key, hit_count)
  values (p_user_id, p_window_key, 1)
  on conflict (user_id, window_key)
    do update set hit_count = ai_rate_limits.hit_count + 1
  returning hit_count into v_count;
  return v_count > p_max_hits;
end;
$$;

revoke all on function public.check_ai_rate_limit(uuid, bigint, int) from public;
revoke all on function public.check_ai_rate_limit(uuid, bigint, int) from authenticated;
grant execute on function public.check_ai_rate_limit(uuid, bigint, int) to service_role;
