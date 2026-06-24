-- Admin privilege audit log.
-- Tracks every change to profiles.is_admin so privilege escalation
-- via a compromised DB credential leaves a forensic trail.

create table if not exists public.admin_audit_log (
  id             uuid        primary key default gen_random_uuid(),
  changed_by     uuid        references auth.users,
  target_user_id uuid        not null references auth.users,
  old_value      boolean,
  new_value      boolean,
  changed_at     timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

-- Admins can read the log; no client can write (trigger-only inserts).
create policy admin_audit_log_select on public.admin_audit_log
  for select
  using (public.current_user_is_admin());

-- The trigger function runs as the table owner (SECURITY DEFINER)
-- so it can bypass RLS to insert audit rows regardless of who triggers it.
create or replace function public.log_admin_flag_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_admin is distinct from new.is_admin then
    insert into public.admin_audit_log (changed_by, target_user_id, old_value, new_value)
    values (auth.uid(), new.id, old.is_admin, new.is_admin);
  end if;
  return new;
end;
$$;

create trigger admin_flag_audit
  after update on public.profiles
  for each row
  execute function public.log_admin_flag_change();

-- Explicit grants: service_role for admin tooling; authenticated role has no
-- direct table access (goes through RLS policies above).
grant select on public.admin_audit_log to authenticated;
