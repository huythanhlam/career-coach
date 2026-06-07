-- Canonicalize "Present" in work history.
--
-- The app now treats the boolean `current` flag as the single source of truth for
-- an ongoing role; `endDate` holds only a real month/year. This migration rewrites
-- any legacy entries that stored the literal string "Present" as the endDate into
-- the canonical shape: { ..., "current": true, "endDate": "" }.
--
-- The application layer also normalizes on read/write, so this is a one-time
-- cleanup. It is idempotent: once converted, no entry has endDate = "Present", so
-- the WHERE clause matches nothing on a re-run.

update public.profiles
set work_history = (
  select jsonb_agg(
    case
      when lower(coalesce(elem ->> 'endDate', '')) = 'present'
        then (elem - 'endDate') || jsonb_build_object('current', true, 'endDate', '')
      else elem
    end
    order by ord
  )
  from jsonb_array_elements(work_history) with ordinality as t(elem, ord)
)
where jsonb_typeof(work_history) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(work_history) as e
    where lower(coalesce(e ->> 'endDate', '')) = 'present'
  );
