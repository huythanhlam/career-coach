-- ─────────────────────────────────────────────────────────
-- User profiles table with first/last name + MFA tracking
-- ─────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  preferred_name text,
  email          text,         -- mirrors auth.users.email for easy querying
  phone         text,
  linkedin      text,
  github        text,
  portfolio     text,
  target_role   text,
  "current_role"  text,
  summary       text,
  skills        text[]  default '{}',
  work_history  jsonb   default '[]',
  education     jsonb   default '[]',
  resume_text   text,
  linkedin_text text,
  onboarding_complete boolean not null default false,
  mfa_enrolled  boolean not null default false,   -- denorm for fast read
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-provision a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, preferred_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'preferred_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Default deny (no policy = no access)

-- Helper: true when the current session satisfies the AAL requirement.
-- If MFA is enrolled, aal2 is required; otherwise aal1 is sufficient.
create or replace function public.session_aal_ok(row_mfa_enrolled boolean)
returns boolean
language sql
stable
security invoker
as $$
  select
    case
      when row_mfa_enrolled then (auth.jwt() ->> 'aal') = 'aal2'
      else true
    end;
$$;

-- Users can read their own profile (aal2 required if MFA enrolled)
create policy "profiles: owner can select"
  on public.profiles for select
  using (
    auth.uid() = id
    and public.session_aal_ok(mfa_enrolled)
  );

-- Users can insert their own profile (e.g. if trigger missed)
-- Insert happens before MFA is set up, so aal1 is fine here.
create policy "profiles: owner can insert"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can update their own profile.
-- Requires aal2 if MFA is enrolled; mfa_enrolled itself is server-managed.
create policy "profiles: owner can update"
  on public.profiles for update
  using (
    auth.uid() = id
    and public.session_aal_ok(mfa_enrolled)
  )
  with check (
    auth.uid() = id
    and public.session_aal_ok(mfa_enrolled)
    -- Prevent client from toggling mfa_enrolled directly
    and mfa_enrolled = (select mfa_enrolled from public.profiles where id = auth.uid())
  );

-- No delete — soft-delete via auth.admin if needed

-- ── Server-side mfa_enrolled toggler (security definer) ────
-- Called by the client after a successful MFA enroll/unenroll.
-- Uses security definer so the RLS update policy cannot be spoofed.
create or replace function public.set_mfa_enrolled(enrolled boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  current_aal text;
  is_enrolled boolean;
begin
  -- Disabling MFA (unenroll) requires an aal2 session — prevents account takeover
  -- by an attacker who only has the password.
  if not enrolled then
    current_aal := auth.jwt() ->> 'aal';
    select mfa_enrolled into is_enrolled from public.profiles where id = auth.uid();
    if is_enrolled and current_aal <> 'aal2' then
      raise exception 'aal2_required'
        using hint = 'Complete MFA verification before removing an authenticator.';
    end if;
  end if;

  update public.profiles
  set mfa_enrolled = enrolled
  where id = auth.uid();
end;
$$;

-- Revoke direct execute from anon; allow authenticated
revoke execute on function public.set_mfa_enrolled(boolean) from anon;
grant execute on function public.set_mfa_enrolled(boolean) to authenticated;
