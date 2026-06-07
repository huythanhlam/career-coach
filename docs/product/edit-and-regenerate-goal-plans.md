# Edit & Regenerate Goal Plans

## Problem
Saved plans are read-only dead ends. Users can't edit the sheet, revisit the answers
that produced it, or regenerate after their situation changes — re-planning means
starting over and losing the prior plan.

## User Stories & Acceptance Criteria
1. **Multiple plans** — Given saved plans, when I open Goal Planner, then I see all and
   can create more. (Preserve existing behavior.)
2. **Responses persist** — Given I generate a plan, when I save it, then my goals,
   per-goal specifics, timeframe, and notes are stored with it.
3. **Edit responses** — Given I open a saved plan, when I click "Edit responses", then
   the intake form is pre-filled with my previous answers.
4. **Regenerate** — Given I changed responses, when I click "Regenerate plan", then a new
   sheet replaces the current one in the open plan.
5. **Edit the sheet** — Given a generated/opened sheet, when I click "Edit", then I can
   edit the markdown directly and apply it.
6. **Save existing vs new** — Given I opened an existing plan, when I save, then it updates
   that plan in place; a fresh plan saves as new.

## Persistence
Stored JSON payload (`user-documents/<uid>/career-plans/<id>.json`) gains an optional
`intake` field: `{ goals: [{ goalType, detail }], timeframe, notes }`. Backward compatible
(older payloads simply have no `intake` and skip the "Edit responses" affordance until
regenerated).

## Non-Goals
- Version history / diffing between plan revisions.
- Collaborative / multi-user editing.
