---
name: new-migration
description: Create a new timestamped Supabase migration file following project conventions (naming, RLS, never editing applied migrations). Use for any database schema change.
---

# Create a Supabase migration

Create a new migration in `supabase/migrations/` for the schema change described in the arguments.

## Rules

1. **Filename**: `YYYYMMDDNNNNNN_short_name.sql` — today's date plus a 6-digit sequence (`000000`, or increment if a migration with today's date already exists; check first with `ls supabase/migrations/`).
2. **Never edit an already-applied migration** — even to fix a typo. Always add a new migration on top.
3. **RLS is mandatory** for any table holding user data:
   - `alter table ... enable row level security;`
   - Policies scoped to `auth.uid()` for user-owned rows; service-role-only writes for synced/system tables (see `20260612000000_company_profiles.sql` for the pattern).
4. **Idempotent guards** where the existing migrations use them (`if not exists`, `or replace`) — match the style of recent migrations in the directory.
5. After writing the migration, remind the user that `supabase/types.ts` is generated and will need regeneration (`supabase gen types typescript`) once the migration is applied — don't hand-edit it.

## Checklist before finishing

- [ ] Filename timestamped and sequenced correctly
- [ ] RLS enabled + policies defined for new tables
- [ ] Indexes for any column used in RLS policies or frequent lookups
- [ ] No destructive change (drop/rename) without calling it out explicitly
