-- ─────────────────────────────────────────────────────────
-- Networking & Referral Agent: outreach tracker
-- One row per person/persona the user plans to reach out to at a target
-- company, with the AI-drafted message and a lightweight status pipeline
-- (to_reach_out → sent → replied → intro → referred). Persona suggestions are
-- role/title targets the user fills in — never scraped real people.
-- ─────────────────────────────────────────────────────────

create table if not exists public.outreach_contacts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  company           text not null,
  target_company_id text,
  contact_name      text,
  contact_title     text,
  contact_linkedin  text,
  persona_type      text,   -- recruiter | hiring_manager | team_member | alumni
  outreach_type     text,   -- linkedin_note | referral | cold_email | coffee_chat
  tone              text,
  message_draft     text,
  status            text not null default 'to_reach_out',
  job_posting_id    uuid references public.job_postings (id) on delete set null,
  notes             text,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint outreach_contacts_status_check check (
    status in ('to_reach_out','sent','replied','intro','referred','closed')
  ),
  constraint outreach_contacts_persona_check check (
    persona_type is null or persona_type in ('recruiter','hiring_manager','team_member','alumni')
  )
);

-- Reuse the shared updated_at trigger function (defined in the profiles migration).
drop trigger if exists outreach_contacts_updated_at on public.outreach_contacts;
create trigger outreach_contacts_updated_at
  before update on public.outreach_contacts
  for each row execute procedure public.set_updated_at();

create index if not exists outreach_contacts_user_status_idx
  on public.outreach_contacts (user_id, status);
create index if not exists outreach_contacts_user_created_idx
  on public.outreach_contacts (user_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────
-- Per-owner + MFA-step-up model, reusing the security-definer helper from the
-- job_postings migration.
alter table public.outreach_contacts enable row level security;

create policy "outreach_contacts: owner can select"
  on public.outreach_contacts for select
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "outreach_contacts: owner can insert"
  on public.outreach_contacts for insert
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "outreach_contacts: owner can update"
  on public.outreach_contacts for update
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  )
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "outreach_contacts: owner can delete"
  on public.outreach_contacts for delete
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );
