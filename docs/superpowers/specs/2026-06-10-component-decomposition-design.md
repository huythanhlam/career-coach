---
title: Workstream 1 — Decompose Oversized Components
date: 2026-06-10
status: approved
---

# Workstream 1: Decompose Oversized Components

## Goal

Break five monolithic component files (1000–1476 lines each) into focused sub-components and hooks. No behavior changes. All existing import paths remain valid.

## Architecture principle

Each oversized file becomes a **co-located folder**. The original file path (e.g. `src/components/DocumentEditor.tsx`) becomes `src/components/DocumentEditor/index.tsx`. All existing consumers continue to import from `@/components/DocumentEditor` unchanged. Extracted pieces live as siblings inside the folder.

---

## 1. DocumentEditor

**Current:** `src/components/DocumentEditor.tsx` (1476 lines)  
**Target:** `src/components/DocumentEditor/` folder

| File | Responsibility | Est. lines |
|---|---|---|
| `index.tsx` | forwardRef shell, state, wires subcomponents | ~250 |
| `EditorToolbar.tsx` | TbBtn, TbSep, all formatting toolbar logic | ~150 |
| `StylePanel.tsx` | StylePanelInline, ColorPickerPopover, IconPicker, InsertMenu | ~250 |
| `AiSuggestionsPanel.tsx` | Right-side AI chat pane | ~150 |

**New lib files:**
- `src/lib/documentMarkdown.ts` — `markdownToHtml`, `htmlToMarkdown`, `sanitizeHref`, text-node utilities (pure functions, no React)
- `src/lib/export/docxExport.ts` — `exportHtmlToDocx` (moved from `src/lib/htmlToDocx.ts` import; update DocumentEditor's import)

All public types (`DocumentEditorHandle`, `DocumentEditorProps`, `DocMessage`, `DocStyle`, `StoredDocumentPayload`) re-exported from `index.tsx`.

---

## 2. ResumeGenerationForm

**Current:** `src/components/ResumeGenerationForm.tsx` (1429 lines)  
**Target:** `src/components/ResumeGenerationForm/` folder

| File | Responsibility | Est. lines |
|---|---|---|
| `index.tsx` | Owns single `useReducer`, renders sections, draft persistence | ~150 |
| `resumeFormReducer.ts` | State type + reducer (no React imports) | ~100 |
| `PersonalInfoSection.tsx` | Name/contact/summary fields | ~150 |
| `WorkHistorySection.tsx` | Job entries + AI bullet suggestions | ~250 |
| `EducationSection.tsx` | Degrees/certs | ~150 |
| `SkillsSection.tsx` | SkillsPicker + role-derived suggestions (`getSkillsForRoles`) | ~150 |
| `TemplatePicker.tsx` | MiniTemplatePreview grid + template selection | ~150 |

**Reducer design:** Single `useReducer` over one flat state object mirroring the current ~33 `useState` declarations. Each section receives its state slice + `dispatch` as props. Draft persistence (`DRAFT_KEY`) serializes the full state object — same as today.

Wrap each section in `React.memo` (props are stable slices + stable dispatch reference).

---

## 3. JobPostingsWorkspace

**Current:** `src/components/JobPostingsWorkspace.tsx` (1097 lines)  
**Target:** `src/components/JobPostingsWorkspace/` folder

| File | Responsibility | Est. lines |
|---|---|---|
| `index.tsx` | Search state, unified list assembly, layout shell | ~200 |
| `ScanControls.tsx` | Search bar, filters, UrlImport, scan buttons | ~150 |
| `PostingList.tsx` | Scrollable list (JobRow, FitScoreCell, CompanyLogo) | ~250 |
| `PostingDetail.tsx` | DetailDrawer + FitBreakdown | ~200 |
| `usePostingDrafts.ts` | Draft-generation actions (cover letter / tailor resume triggers) | ~80 |

Shared `STATUS_META`, `cardStyle`, `inputStyle`, `primaryBtn`, `ghostBtn`, `filterSelectStyle` lifted to `styles.ts` sibling.

---

## 4. GoalPlanningWorkspace

**Current:** `src/components/GoalPlanningWorkspace.tsx` (1048 lines)  
**Target:** `src/components/GoalPlanningWorkspace/` folder

| File | Responsibility | Est. lines |
|---|---|---|
| `index.tsx` | Top-level state, mode routing (`"list" \| "plan" \| "responses"`) | ~150 |
| `IntakeFlow.tsx` | GoalPlanIntakeForm + CurrentStateSurvey orchestration | ~150 |
| `PlanView.tsx` | Markdown plan display, chat panel, edit sheet, save/delete | ~300 |
| `MilestoneList.tsx` | Grouped plan cards with check-in UI | ~200 |
| `ProfileSyncDialog.tsx` | Extracted from bottom of current file | ~80 |
| `SaveDialog.tsx` | Extracted from bottom of current file | ~80 |

---

## 5. WorkflowView

**Current:** `src/components/WorkflowView.tsx` (1001 lines)  
**Target:** `src/components/WorkflowView/` folder

| File | Responsibility | Est. lines |
|---|---|---|
| `index.tsx` | Thin dispatcher: maps `workflowId` → workflow component | ~60 |
| `workflows/MarketWorkflow.tsx` | Market compensation analysis flow | ~150 |
| `workflows/ResumeWorkflow.tsx` | Resume builder/analysis/tailor flow | ~200 |
| `workflows/CoverLetterWorkflow.tsx` | Cover letter creation flow | ~80 |
| `workflows/CompanyResearchWorkflow.tsx` | Company research flow | ~150 |
| `workflows/LinkedInWorkflow.tsx` | LinkedIn optimization flow | ~100 |
| `workflows/GenericWorkflow.tsx` | Fallback form→chat pattern for remaining workflow IDs | ~100 |

The `PageHeader`, `MentorCard`, `FormCard` helpers at the bottom of the current file move to `workflows/shared.tsx`.

---

## Shared conventions

- Shared inline style objects used by 2+ components within a folder → `styles.ts` in that folder.
- Style objects used by only one component stay inline.
- `React.memo` on leaf sections where props are stable.
- No new context providers.
- `src/lib/export/` directory created for export utilities (docx, pdf later).

---

## Constraints

- `npm run lint` (tsc), `npm test`, `npm run build` green after each commit.
- Entry bundle stays under ~150 KB gzipped.
- No visible behavior changes.
- No component file over ~400 lines after decomposition.
- One commit per component (five commits total for this workstream).
- Reuse existing `toast()`, `useUnsavedChangesWarning`, `MODELS` — do not re-invent.

---

## Commit order

1. DocumentEditor → folder + lib extractions
2. ResumeGenerationForm → folder + useReducer
3. JobPostingsWorkspace → folder + usePostingDrafts
4. GoalPlanningWorkspace → folder
5. WorkflowView → folder + workflows/
