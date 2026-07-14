-- F3 Slice A: coach_nudges gains draftable-action support — draft_kind marks
-- a nudge as having a real AI-draftable action (vs. a plain reminder);
-- snoozed_until lets a user temporarily hide a nudge instead of dismissing it
-- forever. See docs/superpowers/specs/2026-07-09-f3-followup-agent-slice-a-design.md §3.

alter table public.coach_nudges
  add column if not exists draft_kind text
    check (draft_kind is null or draft_kind in ('follow_up', 'thank_you'));

alter table public.coach_nudges
  add column if not exists snoozed_until timestamptz;
