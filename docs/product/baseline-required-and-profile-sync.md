# Baseline Identity: Required for Planning + Survey↔Profile Sync

## Problem Statement
The Goal Planner needs the user's starting point — **current role/title** and **company** —
to ground a development plan. Today this lives only in the profile and is treated as
optional, so users who skip the profile get ungrounded plans.

## User Stories & Acceptance Criteria

### 1. Baseline required to generate a plan
- **Given** profile has no current role, **when** I open the Goal Planner, **then** a prominent
  banner asks for my starting point and "Generate my plan" is disabled.
- **Given** I supply a current role (profile *or* survey), **then** generation is enabled.

### 2. Survey as a baseline fallback
- **Given** I don't want to complete the full profile, **when** I open the survey, **then** a
  "Your role today" section captures current role/title, company, years of experience.
- **Given** the profile already has these, **then** the survey section is pre-filled from it.

### 3. Offer to sync survey → profile
- **Given** I entered baseline info AND the matching profile field is empty, **when** I save the
  survey, **then** it is written to the profile directly (no prompt).
- **Given** my survey value differs from a non-empty profile field, **when** I save, **then** I'm
  asked per field whether to overwrite; nothing changes unless I confirm.
- **Given** survey value == profile value, **then** no prompt, no write.

## Field mapping
| Baseline field | Profile destination |
|---|---|
| Current role / title | `profile.currentRole` |
| Company | current `workHistory` entry's `company` (create one if none) |
| Years of experience | `profile.yearsOfExperience` |

## Non-Goals
- Editing full work history from the survey (only the current company is touched).
- Gating the survey itself — only plan generation is gated.

## Success Metric
~100% of generated plans have a non-empty baseline identity.
