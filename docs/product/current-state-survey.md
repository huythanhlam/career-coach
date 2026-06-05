# Current-State Survey → Career Goal Planning Sheet

## Problem Statement
The Goal Planner grounds plans in the user's *profile* (history, skills, education) — a record of the past. It has no read on the user's **present** situation: how they feel about their role, what energizes or frustrates them, whether they're staying or leaving, what's blocking their next step. Without that, generated plans miss the emotional and situational context that makes career advice land. We need a short survey that captures the user's current job situation and feeds it — alongside the profile and goals — into a concrete planning sheet.

## User Stories
- As a user, I want to fill out a quick check-in about my current job so the coach understands where I actually am today.
- As a user, I want my survey saved so I don't re-answer it every time I plan.
- As a user, I want my goal plan to reflect my current frustrations, wins, and intent (stay vs. move), not just my résumé.

## The Survey (12 questions, 3 groups)
**How it's going (1–5 scale):** job satisfaction · growth opportunity · compensation satisfaction · work-life balance · recognition.
**Your situation (single-select):** mobility (Staying & growing / Open to the right move / Actively looking) · manager support (Very / Somewhat / Not really / No manager).
**In your words (free text):** what energizes you · what frustrates/drains you · proudest wins (last 6–12 months) · skills you most want to use or grow · the #1 thing holding you back.

## Acceptance Criteria
- **Given** I open Goal Planner, **when** I haven't filled the survey, **then** a soft prompt invites me to (but I can still generate a plan).
- **Given** I complete the survey and save, **then** it persists to my profile (`career_survey`) and shows a summary I can edit.
- **Given** a saved survey, **when** I generate a plan, **then** the survey summary is included in the AI context with my baseline and goals, and the output is framed as a **Career Goal Planning Sheet** that opens with a current-situation snapshot.
- All survey fields are optional; partial surveys still contribute what's filled.

## Non-Goals
- No analytics/scoring of survey answers. No separate survey history (latest answers only). No new RLS table — reuse the `profiles` row.

## Success Metrics
- % of plans generated with a completed survey; qualitative: plans reference current-state context (frustrations/wins/intent).
