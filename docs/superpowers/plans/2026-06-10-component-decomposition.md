# Component Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break five monolithic React component files (1000–1476 lines each) into focused sub-components and hooks organized in co-located folders, with no behavior changes.

**Architecture:** Each `src/components/Foo.tsx` becomes `src/components/Foo/index.tsx`; extracted pieces live as siblings. All existing import paths stay valid because `@/components/Foo` resolves to `Foo/index.tsx`. All public exports are re-exported from `index.tsx`.

**Tech Stack:** React 18, TypeScript, Vite (with `@/` alias), existing test suite (`npm test`), `npm run lint` (tsc), `npm run build`.

---

## File map

### Task 1 — DocumentEditor

| Action | Path |
|--------|------|
| Rename (git mv) | `src/components/DocumentEditor.tsx` → `src/components/DocumentEditor/index.tsx` |
| Create | `src/components/DocumentEditor/EditorToolbar.tsx` |
| Create | `src/components/DocumentEditor/StylePanel.tsx` |
| Create | `src/components/DocumentEditor/AiSuggestionsPanel.tsx` |
| Create | `src/lib/documentMarkdown.ts` |

### Task 2 — ResumeGenerationForm

| Action | Path |
|--------|------|
| Rename (git mv) | `src/components/ResumeGenerationForm.tsx` → `src/components/ResumeGenerationForm/index.tsx` |
| Create | `src/components/ResumeGenerationForm/resumeFormReducer.ts` |
| Create | `src/components/ResumeGenerationForm/PersonalInfoSection.tsx` |
| Create | `src/components/ResumeGenerationForm/WorkHistorySection.tsx` |
| Create | `src/components/ResumeGenerationForm/EducationSection.tsx` |
| Create | `src/components/ResumeGenerationForm/SkillsSection.tsx` |
| Create | `src/components/ResumeGenerationForm/TemplatePicker.tsx` |

### Task 3 — JobPostingsWorkspace

| Action | Path |
|--------|------|
| Rename (git mv) | `src/components/JobPostingsWorkspace.tsx` → `src/components/JobPostingsWorkspace/index.tsx` |
| Create | `src/components/JobPostingsWorkspace/styles.ts` |
| Create | `src/components/JobPostingsWorkspace/ScanControls.tsx` |
| Create | `src/components/JobPostingsWorkspace/PostingList.tsx` |
| Create | `src/components/JobPostingsWorkspace/PostingDetail.tsx` |
| Create | `src/hooks/usePostingDrafts.ts` |

### Task 4 — GoalPlanningWorkspace

| Action | Path |
|--------|------|
| Rename (git mv) | `src/components/GoalPlanningWorkspace.tsx` → `src/components/GoalPlanningWorkspace/index.tsx` |
| Create | `src/components/GoalPlanningWorkspace/IntakeFlow.tsx` |
| Create | `src/components/GoalPlanningWorkspace/PlanView.tsx` |
| Create | `src/components/GoalPlanningWorkspace/MilestoneList.tsx` |
| Create | `src/components/GoalPlanningWorkspace/ProfileSyncDialog.tsx` |
| Create | `src/components/GoalPlanningWorkspace/SaveDialog.tsx` |

### Task 5 — WorkflowView

| Action | Path |
|--------|------|
| Rename (git mv) | `src/components/WorkflowView.tsx` → `src/components/WorkflowView/index.tsx` |
| Create | `src/components/WorkflowView/workflows/shared.tsx` |
| Create | `src/components/WorkflowView/workflows/MarketWorkflow.tsx` |
| Create | `src/components/WorkflowView/workflows/ResumeWorkflow.tsx` |
| Create | `src/components/WorkflowView/workflows/CoverLetterWorkflow.tsx` |
| Create | `src/components/WorkflowView/workflows/CompanyResearchWorkflow.tsx` |
| Create | `src/components/WorkflowView/workflows/LinkedInWorkflow.tsx` |
| Create | `src/components/WorkflowView/workflows/GenericWorkflow.tsx` |

---

## Task 1: Decompose DocumentEditor

**Files:**
- Rename: `src/components/DocumentEditor.tsx` → `src/components/DocumentEditor/index.tsx`
- Create: `src/components/DocumentEditor/EditorToolbar.tsx`
- Create: `src/components/DocumentEditor/StylePanel.tsx`
- Create: `src/components/DocumentEditor/AiSuggestionsPanel.tsx`
- Create: `src/lib/documentMarkdown.ts`

**Overview of what moves where:**

| Source lines (DocumentEditor.tsx) | Destination |
|---|---|
| Lines 100–168: `sanitizeHref`, `applyInline`, `markdownToHtml`, `htmlToMarkdown` | `src/lib/documentMarkdown.ts` |
| Lines 170–298: `FONT_FAMILIES`, `FONT_SIZES`, `PRESET_COLORS`, `PAPER_COLORS`, `ICON_TABS`, `DENSITY` | `src/components/DocumentEditor/StylePanel.tsx` (constants only used there) |
| Lines 300–566: `ColorPickerPopover`, `IconPicker`, `InsertMenu`, `StylePanelInline` | `src/components/DocumentEditor/StylePanel.tsx` |
| Lines 567–596: `TbSep`, `TbBtn`, `selectStyle` | `src/components/DocumentEditor/EditorToolbar.tsx` |
| Lines 597–709: text-matching helpers (`normalizeChar`, `collectTextNodes`, `blockBoundaryFlags`, `locateTextNodes`, `replaceTextNodes`, `replaceInHtml`, `SUGGESTION_HIGHLIGHT`) | `src/components/DocumentEditor/index.tsx` (keep here; used only by main component) |
| Lines 710–1476: `DocumentEditor` forwardRef component | `src/components/DocumentEditor/index.tsx` |
| The toolbar rendering logic (~lines 820–920 inside DocumentEditor) | `src/components/DocumentEditor/EditorToolbar.tsx` as `EditorToolbar` component |
| The AI chat sidebar rendering (~lines 1100–1250 inside DocumentEditor) | `src/components/DocumentEditor/AiSuggestionsPanel.tsx` as `AiSuggestionsPanel` component |

- [ ] **Step 1: Create `src/lib/documentMarkdown.ts`**

Move the pure markdown↔html functions out. No React imports needed.

```typescript
// src/lib/documentMarkdown.ts

function sanitizeHref(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t) || /^tel:/i.test(t))
    return t.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return "#";
}

function applyInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/<(.+?)>/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, txt, url) => `<a href="${sanitizeHref(url)}">${txt}</a>`);
}

export function markdownToHtml(md: string): string {
  // copy exact implementation from DocumentEditor.tsx lines 117–139
}

export function htmlToMarkdown(html: string): string {
  // copy exact implementation from DocumentEditor.tsx lines 141–168
}
```

> Copy the exact function bodies from `DocumentEditor.tsx` lines 100–168 verbatim. Do not paraphrase.

- [ ] **Step 2: Create `src/components/DocumentEditor/` folder and move the file**

```bash
mkdir -p src/components/DocumentEditor
git mv src/components/DocumentEditor.tsx src/components/DocumentEditor/index.tsx
```

- [ ] **Step 3: Update `markdownToHtml`/`htmlToMarkdown` imports in `index.tsx`**

In `src/components/DocumentEditor/index.tsx`, replace:
```typescript
// remove: the sanitizeHref, applyInline, markdownToHtml, htmlToMarkdown function bodies (lines 100-168)
```
Add at the top imports section:
```typescript
import { markdownToHtml, htmlToMarkdown } from "@/lib/documentMarkdown";
```

Keep `markdownToHtml` and `htmlToMarkdown` re-exported from `index.tsx` so consumers don't break:
```typescript
export { markdownToHtml, htmlToMarkdown } from "@/lib/documentMarkdown";
```

- [ ] **Step 4: Create `src/components/DocumentEditor/StylePanel.tsx`**

Move constants and style sub-components from `index.tsx`:

```typescript
// src/components/DocumentEditor/StylePanel.tsx
import React, { useRef, useState } from "react";
import { Palette, X, Plus, Smile } from "lucide-react";

// Move here from index.tsx:
// - FONT_FAMILIES, FONT_SIZES, PRESET_COLORS, PAPER_COLORS, ICON_TABS, DENSITY (lines 170–298)
// - ColorPickerPopoverProps interface + ColorPickerPopover function (lines 300–355)
// - IconPicker function (lines 356–414)  
// - InsertMenu function (lines 415–441)
// - StylePanelInlineProps interface + StylePanelInline function (lines 442–565)

export { ColorPickerPopover, IconPicker, InsertMenu, StylePanelInline };
export type { ColorPickerPopoverProps, StylePanelInlineProps };
export { FONT_FAMILIES, FONT_SIZES, PRESET_COLORS, PAPER_COLORS, ICON_TABS, DENSITY };
```

In `src/components/DocumentEditor/index.tsx`, replace those blocks with:
```typescript
import { ColorPickerPopover, IconPicker, InsertMenu, StylePanelInline,
  FONT_FAMILIES, FONT_SIZES, PRESET_COLORS, PAPER_COLORS, ICON_TABS, DENSITY
} from "./StylePanel";
```

- [ ] **Step 5: Create `src/components/DocumentEditor/EditorToolbar.tsx`**

Extract toolbar primitives and the toolbar rendering block:

```typescript
// src/components/DocumentEditor/EditorToolbar.tsx
import React from "react";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Minus, RemoveFormatting,
  PanelRightClose, PanelRightOpen, Palette,
  Undo2, Redo2, Smile, Plus,
} from "lucide-react";

// Move here from index.tsx:
// - TbSep function (lines 569–571)
// - TbBtnProps interface + TbBtn function (lines 573–586)
// - selectStyle constant (lines 588–593)

export interface EditorToolbarProps {
  // All the handlers and state values the toolbar needs — derive these from
  // what the toolbar JSX block in DocumentEditor references.
  // Key props: execCmd, execBlock, onFontFamily, onFontSize, onTextColor,
  // onHighlightColor, onInsertMenu, onIconPicker, onUndo, onRedo,
  // onToggleStylePanel, onToggleAI, showAI, showStylePanel,
  // currentTextColor, currentHighlightColor, onClose, docStyle, onExport,
  // onSave, saveStatus, isLoading, title, onTitleChange, exportFileName
}

export const EditorToolbar = React.memo(function EditorToolbar(props: EditorToolbarProps) {
  // Move the toolbar JSX block from inside DocumentEditor here.
  // This is the <div> containing the formatting buttons, roughly lines 820–920.
});

// Also export primitives for use in StylePanel or other places
export { TbSep, TbBtn, selectStyle };
```

In `src/components/DocumentEditor/index.tsx`:
```typescript
import { EditorToolbar } from "./EditorToolbar";
import type { EditorToolbarProps } from "./EditorToolbar";
```

Replace the inline toolbar JSX block with:
```tsx
<EditorToolbar
  execCmd={execCmd}
  // ... pass all props
/>
```

- [ ] **Step 6: Create `src/components/DocumentEditor/AiSuggestionsPanel.tsx`**

Extract the AI chat sidebar:

```typescript
// src/components/DocumentEditor/AiSuggestionsPanel.tsx
import React, { useRef } from "react";
import { Send, Sparkles, X, Bookmark } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import Markdown from "react-markdown";
import type { DocMessage } from "./index";

export interface AiSuggestionsPanelProps {
  messages: DocMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: (e?: React.FormEvent, override?: string) => void;
  isGenerating: boolean;
  placeholder: string;
  selectedContext: string;
  showTailorPrompt: boolean;
  showTailorJd: boolean;
  tailorJdInput: string;
  onTailorJdInputChange: (v: string) => void;
  onTailorJdSubmit: () => void;
  onCloseTailorJd: () => void;
  onOpenTailorJd: () => void;
  customSidebar?: React.ReactNode;
}

export const AiSuggestionsPanel = React.memo(function AiSuggestionsPanel(props: AiSuggestionsPanelProps) {
  // Move the AI sidebar JSX from inside DocumentEditor (roughly lines 1100–1250)
});
```

In `src/components/DocumentEditor/index.tsx`:
```typescript
import { AiSuggestionsPanel } from "./AiSuggestionsPanel";
```

Replace the inline AI sidebar JSX with:
```tsx
<AiSuggestionsPanel
  messages={aiMessages}
  input={chatInput}
  onInputChange={setChatInput}
  onSend={handleSend}
  isGenerating={isAiGenerating}
  placeholder={aiPlaceholder}
  selectedContext={selectedContext}
  showTailorPrompt={showTailorPrompt}
  showTailorJd={showTailorJd}
  tailorJdInput={tailorJdInput}
  onTailorJdInputChange={setTailorJdInput}
  onTailorJdSubmit={handleTailorJdSubmit}
  onCloseTailorJd={() => setShowTailorJd(false)}
  onOpenTailorJd={() => setShowTailorJd(true)}
  customSidebar={customSidebar}
/>
```

- [ ] **Step 7: Verify index.tsx still exports everything consumers need**

Ensure `src/components/DocumentEditor/index.tsx` has these exports (consumers use them):
```typescript
// Types consumed by CoverLetterWorkspace, ResumeGeneratorWorkspace, TailorResumeWorkspace:
export type { DocMessage, DocStyle, StoredDocumentPayload, DocumentEditorProps, DocumentEditorHandle };
export { markdownToHtml, htmlToMarkdown } from "@/lib/documentMarkdown";
export const DocumentEditor = forwardRef<...>(...)
```

- [ ] **Step 8: Run checks**

```bash
npm run lint && npm test && npm run build
```

Expected: all pass, no new TypeScript errors, `dist/assets/index-*.js` ≤ 150 KB gzipped.

- [ ] **Step 9: Commit**

```bash
git add src/components/DocumentEditor/ src/lib/documentMarkdown.ts
git commit -m "refactor: decompose DocumentEditor into EditorToolbar, StylePanel, AiSuggestionsPanel"
```

---

## Task 2: Decompose ResumeGenerationForm

**Files:**
- Rename: `src/components/ResumeGenerationForm.tsx` → `src/components/ResumeGenerationForm/index.tsx`
- Create: `src/components/ResumeGenerationForm/resumeFormReducer.ts`
- Create: `src/components/ResumeGenerationForm/PersonalInfoSection.tsx`
- Create: `src/components/ResumeGenerationForm/WorkHistorySection.tsx`
- Create: `src/components/ResumeGenerationForm/EducationSection.tsx`
- Create: `src/components/ResumeGenerationForm/SkillsSection.tsx`
- Create: `src/components/ResumeGenerationForm/TemplatePicker.tsx`

- [ ] **Step 1: Create the folder and move the file**

```bash
mkdir -p src/components/ResumeGenerationForm
git mv src/components/ResumeGenerationForm.tsx src/components/ResumeGenerationForm/index.tsx
```

- [ ] **Step 2: Create `resumeFormReducer.ts`**

Define the state shape (mirroring the current `useState` declarations) and reducer:

```typescript
// src/components/ResumeGenerationForm/resumeFormReducer.ts

export interface WorkEntry {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
  current: boolean;
}

export interface EducationEntry {
  university: string;
  degree: string;
  graduationYear: string;
  major: string;
  minor: string;
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface ResumeFormState {
  step: 0 | 1 | 2;
  startMethod: "scratch" | "linkedin" | "resume" | null;
  template: string;
  targetRoleSelect: string;
  targetRole: string;
  personalInfo: PersonalInfo;
  workHistory: WorkEntry[];
  education: EducationEntry[];
  skills: string[];
  newSkill: string;
  jobDescription: string;
  profileBannerDismissed: boolean;
  profileWasUsed: boolean;
  autoGeneratedEntries: number[];   // Set<number> serialized as array for reducer
  autoGeneratingEntries: number[];
  isGeneratingBullets: number | null;
  showImport: boolean;
  importText: string;
  importType: "linkedin" | "resume";
  isImporting: boolean;
  importError: string | null;
  expandedWorkIndices: number[];
  expandedEduIndices: number[];
  suggestedSkills: string[];
  draftBannerDismissed: boolean;
  hasDraft: boolean;
  uploadedResumeText: string;
  uploadedFileName: string;
  step0Uploading: "linkedin" | "resume" | null;
  step0Error: string | null;
  step0ResumeUploaded: { text: string; fileName: string } | null;
  processingChoice: "analyze" | "tailor" | "editor" | null;
}

export type ResumeFormAction =
  | { type: "SET_STEP"; payload: 0 | 1 | 2 }
  | { type: "SET_START_METHOD"; payload: "scratch" | "linkedin" | "resume" | null }
  | { type: "SET_TEMPLATE"; payload: string }
  | { type: "SET_TARGET_ROLE_SELECT"; payload: string }
  | { type: "SET_TARGET_ROLE"; payload: string }
  | { type: "SET_PERSONAL_INFO"; payload: PersonalInfo }
  | { type: "SET_PERSONAL_INFO_FIELD"; field: keyof PersonalInfo; payload: string }
  | { type: "SET_WORK_HISTORY"; payload: WorkEntry[] }
  | { type: "SET_WORK_ENTRY"; index: number; payload: Partial<WorkEntry> }
  | { type: "ADD_WORK_ENTRY" }
  | { type: "REMOVE_WORK_ENTRY"; index: number }
  | { type: "SET_EDUCATION"; payload: EducationEntry[] }
  | { type: "SET_EDU_ENTRY"; index: number; payload: Partial<EducationEntry> }
  | { type: "ADD_EDU_ENTRY" }
  | { type: "REMOVE_EDU_ENTRY"; index: number }
  | { type: "SET_SKILLS"; payload: string[] }
  | { type: "SET_NEW_SKILL"; payload: string }
  | { type: "SET_JOB_DESCRIPTION"; payload: string }
  | { type: "SET_PROFILE_BANNER_DISMISSED"; payload: boolean }
  | { type: "SET_PROFILE_WAS_USED"; payload: boolean }
  | { type: "SET_AUTO_GENERATED_ENTRIES"; payload: number[] }
  | { type: "SET_AUTO_GENERATING_ENTRIES"; payload: number[] }
  | { type: "SET_IS_GENERATING_BULLETS"; payload: number | null }
  | { type: "SET_SHOW_IMPORT"; payload: boolean }
  | { type: "SET_IMPORT_TEXT"; payload: string }
  | { type: "SET_IMPORT_TYPE"; payload: "linkedin" | "resume" }
  | { type: "SET_IS_IMPORTING"; payload: boolean }
  | { type: "SET_IMPORT_ERROR"; payload: string | null }
  | { type: "TOGGLE_WORK_EXPANDED"; index: number }
  | { type: "SET_EXPANDED_WORK_INDICES"; payload: number[] }
  | { type: "TOGGLE_EDU_EXPANDED"; index: number }
  | { type: "SET_EXPANDED_EDU_INDICES"; payload: number[] }
  | { type: "SET_SUGGESTED_SKILLS"; payload: string[] }
  | { type: "SET_DRAFT_BANNER_DISMISSED"; payload: boolean }
  | { type: "SET_HAS_DRAFT"; payload: boolean }
  | { type: "SET_UPLOADED_RESUME_TEXT"; payload: string }
  | { type: "SET_UPLOADED_FILE_NAME"; payload: string }
  | { type: "SET_STEP0_UPLOADING"; payload: "linkedin" | "resume" | null }
  | { type: "SET_STEP0_ERROR"; payload: string | null }
  | { type: "SET_STEP0_RESUME_UPLOADED"; payload: { text: string; fileName: string } | null }
  | { type: "SET_PROCESSING_CHOICE"; payload: "analyze" | "tailor" | "editor" | null }
  | { type: "RESTORE_DRAFT"; payload: Partial<ResumeFormState> };

export function resumeFormReducer(state: ResumeFormState, action: ResumeFormAction): ResumeFormState {
  switch (action.type) {
    case "SET_STEP": return { ...state, step: action.payload };
    case "SET_START_METHOD": return { ...state, startMethod: action.payload };
    case "SET_TEMPLATE": return { ...state, template: action.payload };
    case "SET_TARGET_ROLE_SELECT": return { ...state, targetRoleSelect: action.payload };
    case "SET_TARGET_ROLE": return { ...state, targetRole: action.payload };
    case "SET_PERSONAL_INFO": return { ...state, personalInfo: action.payload };
    case "SET_PERSONAL_INFO_FIELD": return { ...state, personalInfo: { ...state.personalInfo, [action.field]: action.payload } };
    case "SET_WORK_HISTORY": return { ...state, workHistory: action.payload };
    case "SET_WORK_ENTRY": return {
      ...state,
      workHistory: state.workHistory.map((e, i) => i === action.index ? { ...e, ...action.payload } : e),
    };
    case "ADD_WORK_ENTRY": return {
      ...state,
      workHistory: [...state.workHistory, { company: "", role: "", startDate: "", endDate: "", responsibilities: "", current: false }],
      expandedWorkIndices: [...state.expandedWorkIndices, state.workHistory.length],
    };
    case "REMOVE_WORK_ENTRY": return {
      ...state,
      workHistory: state.workHistory.filter((_, i) => i !== action.index),
      expandedWorkIndices: state.expandedWorkIndices.filter(i => i !== action.index).map(i => i > action.index ? i - 1 : i),
    };
    case "SET_EDUCATION": return { ...state, education: action.payload };
    case "SET_EDU_ENTRY": return {
      ...state,
      education: state.education.map((e, i) => i === action.index ? { ...e, ...action.payload } : e),
    };
    case "ADD_EDU_ENTRY": return {
      ...state,
      education: [...state.education, { university: "", degree: "", graduationYear: "", major: "", minor: "" }],
      expandedEduIndices: [...state.expandedEduIndices, state.education.length],
    };
    case "REMOVE_EDU_ENTRY": return {
      ...state,
      education: state.education.filter((_, i) => i !== action.index),
      expandedEduIndices: state.expandedEduIndices.filter(i => i !== action.index).map(i => i > action.index ? i - 1 : i),
    };
    case "SET_SKILLS": return { ...state, skills: action.payload };
    case "SET_NEW_SKILL": return { ...state, newSkill: action.payload };
    case "SET_JOB_DESCRIPTION": return { ...state, jobDescription: action.payload };
    case "SET_PROFILE_BANNER_DISMISSED": return { ...state, profileBannerDismissed: action.payload };
    case "SET_PROFILE_WAS_USED": return { ...state, profileWasUsed: action.payload };
    case "SET_AUTO_GENERATED_ENTRIES": return { ...state, autoGeneratedEntries: action.payload };
    case "SET_AUTO_GENERATING_ENTRIES": return { ...state, autoGeneratingEntries: action.payload };
    case "SET_IS_GENERATING_BULLETS": return { ...state, isGeneratingBullets: action.payload };
    case "SET_SHOW_IMPORT": return { ...state, showImport: action.payload };
    case "SET_IMPORT_TEXT": return { ...state, importText: action.payload };
    case "SET_IMPORT_TYPE": return { ...state, importType: action.payload };
    case "SET_IS_IMPORTING": return { ...state, isImporting: action.payload };
    case "SET_IMPORT_ERROR": return { ...state, importError: action.payload };
    case "TOGGLE_WORK_EXPANDED": return {
      ...state,
      expandedWorkIndices: state.expandedWorkIndices.includes(action.index)
        ? state.expandedWorkIndices.filter(i => i !== action.index)
        : [...state.expandedWorkIndices, action.index],
    };
    case "SET_EXPANDED_WORK_INDICES": return { ...state, expandedWorkIndices: action.payload };
    case "TOGGLE_EDU_EXPANDED": return {
      ...state,
      expandedEduIndices: state.expandedEduIndices.includes(action.index)
        ? state.expandedEduIndices.filter(i => i !== action.index)
        : [...state.expandedEduIndices, action.index],
    };
    case "SET_EXPANDED_EDU_INDICES": return { ...state, expandedEduIndices: action.payload };
    case "SET_SUGGESTED_SKILLS": return { ...state, suggestedSkills: action.payload };
    case "SET_DRAFT_BANNER_DISMISSED": return { ...state, draftBannerDismissed: action.payload };
    case "SET_HAS_DRAFT": return { ...state, hasDraft: action.payload };
    case "SET_UPLOADED_RESUME_TEXT": return { ...state, uploadedResumeText: action.payload };
    case "SET_UPLOADED_FILE_NAME": return { ...state, uploadedFileName: action.payload };
    case "SET_STEP0_UPLOADING": return { ...state, step0Uploading: action.payload };
    case "SET_STEP0_ERROR": return { ...state, step0Error: action.payload };
    case "SET_STEP0_RESUME_UPLOADED": return { ...state, step0ResumeUploaded: action.payload };
    case "SET_PROCESSING_CHOICE": return { ...state, processingChoice: action.payload };
    case "RESTORE_DRAFT": return { ...state, ...action.payload };
    default: return state;
  }
}

export function makeInitialState(profile: any): ResumeFormState {
  return {
    step: 0,
    startMethod: null,
    template: "Modern & Clean",
    targetRoleSelect: profile.targetRole ? "Other" : "",
    targetRole: profile.targetRole ?? "",
    personalInfo: {
      name: profile.fullName ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      linkedin: profile.linkedin ?? "",
      github: profile.github ?? "",
      portfolio: profile.portfolio ?? "",
    },
    workHistory: profile.workHistory?.length
      ? profile.workHistory.map(({ company, role, startDate, endDate, responsibilities, current }: any) => ({
          company, role, startDate, endDate, responsibilities, current: Boolean(current),
        }))
      : [{ company: "", role: "", startDate: "", endDate: "", responsibilities: "", current: false }],
    education: profile.education?.length
      ? profile.education.map(({ university, degree, graduationYear, major, minor }: any) => ({
          university, degree, graduationYear, major: major ?? "", minor: minor ?? "",
        }))
      : [{ university: "", degree: "", graduationYear: "", major: "", minor: "" }],
    skills: profile.skills ?? [],
    newSkill: "",
    jobDescription: "",
    profileBannerDismissed: false,
    profileWasUsed: false,
    autoGeneratedEntries: [],
    autoGeneratingEntries: [],
    isGeneratingBullets: null,
    showImport: false,
    importText: "",
    importType: "linkedin",
    isImporting: false,
    importError: null,
    expandedWorkIndices: profile.workHistory?.length
      ? profile.workHistory.map((_: any, i: number) => i)
      : [0],
    expandedEduIndices: profile.education?.length
      ? profile.education.map((_: any, i: number) => i)
      : [0],
    suggestedSkills: [],
    draftBannerDismissed: false,
    hasDraft: false,
    uploadedResumeText: "",
    uploadedFileName: "",
    step0Uploading: null,
    step0Error: null,
    step0ResumeUploaded: null,
    processingChoice: null,
  };
}
```

- [ ] **Step 3: Create section sub-components**

Each section takes state slices and `dispatch`. Pattern for all five:

```typescript
// src/components/ResumeGenerationForm/PersonalInfoSection.tsx
import React from "react";
import { Input } from "@/components/ui/input";
import type { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

interface Props {
  state: Pick<ResumeFormState, "personalInfo" | "targetRole" | "targetRoleSelect">;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const PersonalInfoSection = React.memo(function PersonalInfoSection({ state, dispatch }: Props) {
  // Move personal info JSX from index.tsx here.
  // All setPersonalInfo(x) calls become: dispatch({ type: "SET_PERSONAL_INFO", payload: x })
  // setTargetRole(x) → dispatch({ type: "SET_TARGET_ROLE", payload: x })
});
```

```typescript
// src/components/ResumeGenerationForm/WorkHistorySection.tsx
import React, { useRef } from "react";
import { Plus, Trash2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { ComboInput } from "@/components/ui/ComboInput";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { EndDateField } from "@/components/ui/EndDateField";
import { endDateLabel } from "@/lib/workExperience";
import { JOB_TITLES, SP500_COMPANIES } from "@/lib/profileOptions";
import { suggestWorkExperienceBullets } from "@/services/geminiService";
import type { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

interface Props {
  state: Pick<ResumeFormState,
    "workHistory" | "expandedWorkIndices" | "autoGeneratedEntries" |
    "autoGeneratingEntries" | "isGeneratingBullets"
  >;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const WorkHistorySection = React.memo(function WorkHistorySection({ state, dispatch }: Props) {
  // Move work history JSX from index.tsx here.
});
```

```typescript
// src/components/ResumeGenerationForm/EducationSection.tsx
import React from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { ComboInput } from "@/components/ui/ComboInput";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { UNIVERSITIES, DEGREE_TYPES, COMMON_MAJORS, COMMON_MINORS } from "@/lib/profileOptions";
import type { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

interface Props {
  state: Pick<ResumeFormState, "education" | "expandedEduIndices">;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const EducationSection = React.memo(function EducationSection({ state, dispatch }: Props) {
  // Move education JSX from index.tsx here.
});
```

```typescript
// src/components/ResumeGenerationForm/SkillsSection.tsx
import React from "react";
import { SkillsPicker } from "@/components/ui/SkillsPicker";
import { SKILLS_BY_CATEGORY } from "@/lib/profileOptions";
import type { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

// Move getSkillsForRoles from index.tsx here (it only feeds this section)
function getSkillsForRoles(roles: string[]): string[] {
  // copy exact implementation from ResumeGenerationForm.tsx lines 41–64
}

interface Props {
  state: Pick<ResumeFormState, "skills" | "newSkill" | "suggestedSkills" | "targetRole">;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const SkillsSection = React.memo(function SkillsSection({ state, dispatch }: Props) {
  // Move skills JSX from index.tsx here.
});
```

```typescript
// src/components/ResumeGenerationForm/TemplatePicker.tsx
import React from "react";
import { COMMON_ROLES } from "@/config/workflows";
import type { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

// Move MiniTemplatePreview from index.tsx here (only used in TemplatePicker)
function MiniTemplatePreview({ type }: { type: string }) {
  // copy exact implementation from ResumeGenerationForm.tsx lines 66–218
}

interface Props {
  state: Pick<ResumeFormState, "template">;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const TemplatePicker = React.memo(function TemplatePicker({ state, dispatch }: Props) {
  // Move template selection JSX from index.tsx here.
  // setTemplate(x) → dispatch({ type: "SET_TEMPLATE", payload: x })
});
```

- [ ] **Step 4: Rewrite `index.tsx` to use `useReducer` + section components**

```typescript
// src/components/ResumeGenerationForm/index.tsx
import React, { useReducer, useEffect, useRef, useCallback } from "react";
import { useUserProfile } from "@/context/UserProfileContext";
import { parseDocumentToText } from "@/services/documentParserService";
import { buildResumeDocumentFromText, ResumeImportError } from "@/services/resumeImportService";
import { parseProfileFromImport } from "@/services/geminiService";
import { resumeFormReducer, makeInitialState, type ResumeFormState } from "./resumeFormReducer";
import { PersonalInfoSection } from "./PersonalInfoSection";
import { WorkHistorySection } from "./WorkHistorySection";
import { EducationSection } from "./EducationSection";
import { SkillsSection } from "./SkillsSection";
import { TemplatePicker } from "./TemplatePicker";

const DRAFT_KEY = "resume_builder_draft";

export function ResumeGenerationForm({ onSubmit, isGenerating, onAnalyze, onTailor, onImportToEditor }: {
  onSubmit: (data: any) => void;
  isGenerating: boolean;
  onAnalyze?: (resumeText: string, file: File) => void;
  onTailor?: (resumeText: string, resumeName: string) => void;
  onImportToEditor?: (markdown: string) => void;
}) {
  const { profile, loading } = useUserProfile();
  const [state, dispatch] = useReducer(resumeFormReducer, profile, makeInitialState);

  // Migrate all useEffect bodies and handler functions from the old index.tsx,
  // replacing every setState(x) call with dispatch({ type: "SET_...", payload: x }).
  // The draft persistence useEffect serializes `state` to localStorage[DRAFT_KEY].

  return (
    // Migrate the JSX return from index.tsx, replacing inline section JSX with:
    <>
      <PersonalInfoSection state={state} dispatch={dispatch} />
      <WorkHistorySection state={state} dispatch={dispatch} />
      <EducationSection state={state} dispatch={dispatch} />
      <SkillsSection state={state} dispatch={dispatch} />
      <TemplatePicker state={state} dispatch={dispatch} />
    </>
    // Plus: step routing, draft banner, profile banner, import modal, submit button —
    // these stay in index.tsx as they coordinate the whole form.
  );
}
```

- [ ] **Step 5: Run checks**

```bash
npm run lint && npm test && npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ResumeGenerationForm/
git commit -m "refactor: decompose ResumeGenerationForm into sections with useReducer"
```

---

## Task 3: Decompose JobPostingsWorkspace

**Files:**
- Rename: `src/components/JobPostingsWorkspace.tsx` → `src/components/JobPostingsWorkspace/index.tsx`
- Create: `src/components/JobPostingsWorkspace/styles.ts`
- Create: `src/components/JobPostingsWorkspace/ScanControls.tsx`
- Create: `src/components/JobPostingsWorkspace/PostingList.tsx`
- Create: `src/components/JobPostingsWorkspace/PostingDetail.tsx`
- Create: `src/hooks/usePostingDrafts.ts`

- [ ] **Step 1: Create folder and move file**

```bash
mkdir -p src/components/JobPostingsWorkspace
git mv src/components/JobPostingsWorkspace.tsx src/components/JobPostingsWorkspace/index.tsx
```

- [ ] **Step 2: Create `styles.ts`**

Move all module-level style constants (currently in the file before the component):

```typescript
// src/components/JobPostingsWorkspace/styles.ts
import type { JobStatus } from "@/types/jobPosting";

export const STATUS_META: Record<JobStatus, { label: string; fg: string; bg: string; border: string }> = {
  // copy exact object from JobPostingsWorkspace.tsx lines 29–38
};

export const cardStyle: React.CSSProperties = {
  // copy from lines 46–48
};
export const inputStyle: React.CSSProperties = {
  // copy from lines 49–53
};
export const primaryBtn: React.CSSProperties = {
  // copy from lines 54–59
};
export const ghostBtn: React.CSSProperties = {
  // copy from lines 60–65
};
export const filterSelectStyle: React.CSSProperties = {
  // copy from lines 66–70
};
```

In `index.tsx`, replace the inline constants with:
```typescript
import { STATUS_META, cardStyle, inputStyle, primaryBtn, ghostBtn, filterSelectStyle } from "./styles";
```

- [ ] **Step 3: Create `usePostingDrafts.ts`**

```typescript
// src/hooks/usePostingDrafts.ts
import type { ViewId } from "@/components/Sidebar";
import type { JobPosting } from "@/types/jobPosting";

interface UsePostingDraftsOptions {
  onNavigate?: (view: ViewId) => void;
}

export function usePostingDrafts({ onNavigate }: UsePostingDraftsOptions) {
  // Extract draft-generation actions from JobPostingsWorkspace:
  // - handleGenerateCoverLetter(posting): navigates to cover_letter workflow with posting context
  // - handleTailorResume(posting): navigates to resume_generation workflow with posting context
  // These currently live inline in the DetailDrawer render or in event handlers inside the
  // main component. Move the navigation/dispatch logic here and return the two handlers.
  return {
    handleGenerateCoverLetter: (posting: JobPosting) => {
      // navigate to cover letter workflow passing posting details
      onNavigate?.("workflows");
    },
    handleTailorResume: (posting: JobPosting) => {
      onNavigate?.("workflows");
    },
  };
}
```

> Inspect `JobPostingsWorkspace/index.tsx` lines ~340–420 to find the exact cover-letter/tailor handlers and move their bodies here.

- [ ] **Step 4: Create `ScanControls.tsx`**

```typescript
// src/components/JobPostingsWorkspace/ScanControls.tsx
import React from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { inputStyle, primaryBtn, ghostBtn, filterSelectStyle } from "./styles";
import { JOB_LEVELS, WORKPLACE_TYPES, type JobLevel, type Workplace } from "@/lib/jobFilters";
import { UrlImport } from "./UrlImport"; // see note below

// UrlImport (lines 610–636) is a small helper; move it to ScanControls.tsx or its own file.

export interface ScanControlsProps {
  keyword: string;
  location: string;
  level: JobLevel | "any";
  workplace: Workplace | "any";
  loading: boolean;
  savedOnly: boolean;
  onKeywordChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onLevelChange: (v: JobLevel | "any") => void;
  onWorkplaceChange: (v: Workplace | "any") => void;
  onSearch: () => void;
  onSavedOnlyChange: (v: boolean) => void;
  onUrlImport: (url: string) => Promise<void>;
  locationSuggestions: string[];
}

export const ScanControls = React.memo(function ScanControls(props: ScanControlsProps) {
  // Move the search bar + filter row JSX from index.tsx here (~lines 230–330)
});
```

- [ ] **Step 5: Create `PostingList.tsx`**

```typescript
// src/components/JobPostingsWorkspace/PostingList.tsx
import React from "react";
import { Star, Loader2 } from "lucide-react";
import { cardStyle, STATUS_META } from "./styles";
import type { ListItem } from "./index"; // re-export ListItem from index
import type { FitFactor } from "@/services/jobRecommendation";

// Move here from index.tsx:
// - CompanyLogo component (lines 428–464)
// - FitScoreCell component (lines 465–521)
// - JobRow component (lines 522–608)

export interface PostingListProps {
  items: ListItem[];
  detailId: string | null;
  onSelect: (id: string | null) => void;
  loading: boolean;
  savedOnly: boolean;
}

export const PostingList = React.memo(function PostingList(props: PostingListProps) {
  // Move the list JSX from index.tsx here, using JobRow internally
});
```

- [ ] **Step 6: Create `PostingDetail.tsx`**

```typescript
// src/components/JobPostingsWorkspace/PostingDetail.tsx
import React from "react";
import { X, Loader2, Star, Trash2, ExternalLink, Mail, FileText, ArrowRight } from "lucide-react";
import { cardStyle, STATUS_META, primaryBtn, ghostBtn } from "./styles";
import { JobDescription } from "@/components/JobDescription";
import type { JobPosting } from "@/types/jobPosting";

// Move here from index.tsx:
// - ImportDraftModal (lines 637–671)
// - FitBreakdown (lines 672–724)
// - PreviewDrawer (lines 725–799)
// - DetailDrawer (lines 800–1055)
// - SectionHeading, Label, Modal (lines 1056–1097)

export interface PostingDetailProps {
  posting: JobPosting | null;
  onClose: () => void;
  onUpdatePosting: (id: string, patch: Partial<JobPosting>) => void;
  onDeletePosting: (id: string) => void;
  onGenerateCoverLetter: (posting: JobPosting) => void;
  onTailorResume: (posting: JobPosting) => void;
  profile: any;
}

export const PostingDetail = React.memo(function PostingDetail(props: PostingDetailProps) {
  // Move DetailDrawer + PreviewDrawer logic here
});
```

- [ ] **Step 7: Wire up `index.tsx`**

`index.tsx` becomes the coordinator: holds search state + unified list assembly, renders `ScanControls`, `PostingList`, `PostingDetail` side by side.

```typescript
// src/components/JobPostingsWorkspace/index.tsx
// Keep: all state, useMemo for list assembly, usePostingDrafts hook call
// Replace inline JSX sections with the three sub-components
import { ScanControls } from "./ScanControls";
import { PostingList } from "./PostingList";
import { PostingDetail } from "./PostingDetail";
import { usePostingDrafts } from "@/hooks/usePostingDrafts";

// Re-export for consumers
export { JobPostingsWorkspace };
export type { ListItem };
```

- [ ] **Step 8: Run checks**

```bash
npm run lint && npm test && npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/components/JobPostingsWorkspace/ src/hooks/usePostingDrafts.ts
git commit -m "refactor: decompose JobPostingsWorkspace into ScanControls, PostingList, PostingDetail"
```

---

## Task 4: Decompose GoalPlanningWorkspace

**Files:**
- Rename: `src/components/GoalPlanningWorkspace.tsx` → `src/components/GoalPlanningWorkspace/index.tsx`
- Create: `src/components/GoalPlanningWorkspace/IntakeFlow.tsx`
- Create: `src/components/GoalPlanningWorkspace/PlanView.tsx`
- Create: `src/components/GoalPlanningWorkspace/MilestoneList.tsx`
- Create: `src/components/GoalPlanningWorkspace/ProfileSyncDialog.tsx`
- Create: `src/components/GoalPlanningWorkspace/SaveDialog.tsx`

- [ ] **Step 1: Create folder and move file**

```bash
mkdir -p src/components/GoalPlanningWorkspace
git mv src/components/GoalPlanningWorkspace.tsx src/components/GoalPlanningWorkspace/index.tsx
```

- [ ] **Step 2: Extract `ProfileSyncDialog.tsx`**

It's self-contained at the bottom of the file (~lines 949–1010):

```typescript
// src/components/GoalPlanningWorkspace/ProfileSyncDialog.tsx
import React, { useState } from "react";
import type { IdentitySyncField, IdentityKey } from "@/lib/careerBaseline";

interface ProfileSyncDialogProps {
  conflicts: IdentitySyncField[];
  onApply: (keys: IdentityKey[]) => void;
  onDismiss: () => void;
  syncing: boolean;
}

export function ProfileSyncDialog({ conflicts, onApply, onDismiss, syncing }: ProfileSyncDialogProps) {
  // copy exact implementation from GoalPlanningWorkspace.tsx lines 949–1010
}
```

- [ ] **Step 3: Extract `SaveDialog.tsx`**

Self-contained at the bottom (~lines 1011–1048):

```typescript
// src/components/GoalPlanningWorkspace/SaveDialog.tsx
import React, { useState } from "react";
import type { SavedCareerPlan } from "@/types/userProfile";

interface SaveDialogProps {
  existingPlan?: SavedCareerPlan;
  asCopy: boolean;
  onSave: (title: string, goalType: string) => void;
  onCancel: () => void;
  saving: boolean;
  goalType: string;
}

export function SaveDialog(props: SaveDialogProps) {
  // copy exact implementation from GoalPlanningWorkspace.tsx lines 1011–1048
}
```

- [ ] **Step 4: Extract `IntakeFlow.tsx`**

Orchestrates the baseline survey + goal intake form (the `mode === "list"` pathway that shows `GoalPlanIntakeForm` and `CurrentStateSurvey`):

```typescript
// src/components/GoalPlanningWorkspace/IntakeFlow.tsx
import React from "react";
import { GoalPlanIntakeForm, type GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";
import { CurrentStateSurvey } from "@/components/CurrentStateSurvey";
import type { CareerSurvey } from "@/types/userProfile";

export interface IntakeFlowProps {
  thin: boolean;
  hasBaseline: boolean;
  profileHasBaseline: boolean;
  baselineSurveyOpen: boolean;
  savingSurvey: boolean;
  initialSurvey: CareerSurvey;
  onOpenSurvey: () => void;
  onSaveSurvey: (survey: CareerSurvey) => void;
  onGenerate: (intake: GoalPlanIntakeData) => void;
  isGenerating: boolean;
}

export function IntakeFlow(props: IntakeFlowProps) {
  // Move the intake/survey JSX block from GoalPlanningWorkspace (mode === "list" branch, ~lines 450–650)
}
```

- [ ] **Step 5: Extract `MilestoneList.tsx`**

The saved-plans list with group headers and plan cards:

```typescript
// src/components/GoalPlanningWorkspace/MilestoneList.tsx
import React from "react";
import Markdown from "react-markdown";
import { Bookmark, Trash2, ChevronDown, ChevronRight, Layers } from "lucide-react";
import type { SavedCareerPlan } from "@/types/userProfile";

export interface MilestoneListProps {
  groupedPlans: Record<string, SavedCareerPlan[]>;
  collapsedGroups: Set<string>;
  loadingPlanId: string | null;
  onToggleGroup: (key: string) => void;
  onOpenPlan: (plan: SavedCareerPlan) => void;
  onDeletePlan: (plan: SavedCareerPlan) => void;
}

export const MilestoneList = React.memo(function MilestoneList(props: MilestoneListProps) {
  // Move renderPlanCard + the grouped list render from GoalPlanningWorkspace (~lines 416–448 + list render ~lines 650–750)
});
```

- [ ] **Step 6: Extract `PlanView.tsx`**

The `mode === "plan"` view — markdown display, chat panel, edit sheet:

```typescript
// src/components/GoalPlanningWorkspace/PlanView.tsx
import React, { useRef } from "react";
import Markdown from "react-markdown";
import { Send, Loader2, Pencil, Copy, Bookmark, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMsg } from "./index";
import type { GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";

export interface PlanViewProps {
  planMarkdown: string;
  messages: ChatMsg[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: (e?: React.FormEvent) => void;
  isGenerating: boolean;
  editingSheet: boolean;
  draftMarkdown: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onApplyEdit: () => void;
  onCancelEdit: () => void;
  onBack: () => void;
  onSave: () => void;
  onSaveAsCopy: () => void;
  currentIntake: GoalPlanIntakeData | null;
  onViewResponses: () => void;
}

export const PlanView = React.memo(function PlanView(props: PlanViewProps) {
  // Move the mode === "plan" JSX from GoalPlanningWorkspace (~lines 750–948)
});
```

- [ ] **Step 7: Wire up `index.tsx`**

```typescript
// src/components/GoalPlanningWorkspace/index.tsx
// Keep: all state, handlers (handleGenerate, handleSend, handleOpen, handleDelete, handleSave, etc.)
// Import and use sub-components:
import { IntakeFlow } from "./IntakeFlow";
import { MilestoneList } from "./MilestoneList";
import { PlanView } from "./PlanView";
import { ProfileSyncDialog } from "./ProfileSyncDialog";
import { SaveDialog } from "./SaveDialog";

export type { ChatMsg };
export { GoalPlanningWorkspace };
```

The mode switch becomes:
```tsx
{mode === "list" && (
  <>
    <IntakeFlow ... />
    <MilestoneList ... />
  </>
)}
{mode === "plan" && <PlanView ... />}
{mode === "responses" && /* inline — short enough to keep in index.tsx */}
{syncConflicts.length > 0 && <ProfileSyncDialog ... />}
{saveDialogOpen && <SaveDialog ... />}
```

- [ ] **Step 8: Run checks**

```bash
npm run lint && npm test && npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/components/GoalPlanningWorkspace/
git commit -m "refactor: decompose GoalPlanningWorkspace into IntakeFlow, PlanView, MilestoneList"
```

---

## Task 5: Decompose WorkflowView

**Files:**
- Rename: `src/components/WorkflowView.tsx` → `src/components/WorkflowView/index.tsx`
- Create: `src/components/WorkflowView/workflows/shared.tsx`
- Create: `src/components/WorkflowView/workflows/MarketWorkflow.tsx`
- Create: `src/components/WorkflowView/workflows/ResumeWorkflow.tsx`
- Create: `src/components/WorkflowView/workflows/CoverLetterWorkflow.tsx`
- Create: `src/components/WorkflowView/workflows/CompanyResearchWorkflow.tsx`
- Create: `src/components/WorkflowView/workflows/LinkedInWorkflow.tsx`
- Create: `src/components/WorkflowView/workflows/GenericWorkflow.tsx`

- [ ] **Step 1: Create folder structure and move file**

```bash
mkdir -p src/components/WorkflowView/workflows
git mv src/components/WorkflowView.tsx src/components/WorkflowView/index.tsx
```

- [ ] **Step 2: Create `workflows/shared.tsx`**

Move the bottom-of-file helpers:

```typescript
// src/components/WorkflowView/workflows/shared.tsx
import React from "react";

// Move from WorkflowView.tsx:
// - PageHeader (lines 889–899)
// - MentorCard (lines 900–907)
// - FormCard (lines 908–end)

export function PageHeader({ title, description }: { title: string; description: string }) {
  // copy exact implementation
}

export function MentorCard({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  // copy exact implementation
}

export function FormCard(props: any) {
  // copy exact implementation
}
```

- [ ] **Step 3: Create each workflow component**

Each workflow component receives the state it needs as props. The pattern for each:

```typescript
// src/components/WorkflowView/workflows/MarketWorkflow.tsx
import React from "react";
import { MarketCompensationViz, type MarketCompData } from "@/components/MarketCompensationViz";
import { PageHeader, MentorCard, FormCard } from "./shared";
import type { WorkflowConfig } from "@/config/workflows";

export interface MarketWorkflowProps {
  config: WorkflowConfig;
  formData: Record<string, any>;
  marketData: MarketCompData | null;
  marketCachedAt: string | null;
  isGeneratingMarketData: boolean;
  marketSaveState: "idle" | "saving" | "saved";
  onInputChange: (key: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onRefresh: () => void;
  onSave: () => void;
}

export function MarketWorkflow(props: MarketWorkflowProps) {
  // Move the workflowId === "market" branch from WorkflowView/index.tsx (~lines 690–734)
}
```

```typescript
// src/components/WorkflowView/workflows/ResumeWorkflow.tsx
import React from "react";
import { ResumeGenerationForm } from "@/components/ResumeGenerationForm";
import { ResumeGeneratorWorkspace } from "@/components/ResumeGeneratorWorkspace";
import { ResumeAnalysisWorkspace } from "@/components/ResumeAnalysisWorkspace";
import { TailorResumeWorkspace } from "@/components/TailorResumeWorkspace";
import { PageHeader, MentorCard } from "./shared";
import type { ResumeAnalysisResult } from "@/services/geminiService";

export interface ResumeWorkflowProps {
  // All state variables that the resume_generation if-chain reads from WorkflowView
  resumeGeneratorData: Record<string, any> | null;
  savedResumeText: string | null;
  builderAnalysisText: string | null;
  builderAnalysisFile: { file: File; objectUrl: string } | null;
  builderAnalysisResult: ResumeAnalysisResult | null;
  isBuilderAnalyzing: boolean;
  loadingResumeId: string | null;
  showTailor: boolean;
  tailorInitialResume: { text: string; name: string } | null;
  onSubmit: (data: any) => void;
  onAnalyze: (resumeText: string, file: File) => void;
  onTailor: (resumeText: string, name: string) => void;
  onSaveResume: () => void;
  onResetTailor: () => void;
  isGenerating: boolean;
}

export function ResumeWorkflow(props: ResumeWorkflowProps) {
  // Move all workflowId === "resume_generation" branches (~lines 388–392, 479–544, 621–689)
}
```

```typescript
// src/components/WorkflowView/workflows/CoverLetterWorkflow.tsx
import React from "react";
import { CoverLetterWorkspace, type SavedCoverLetterPayload } from "@/components/CoverLetterWorkspace";
import { CoverLetterForm, type CoverLetterFormData } from "@/components/CoverLetterForm";
import { PageHeader, MentorCard } from "./shared";

export interface CoverLetterWorkflowProps {
  coverLetterFormData: CoverLetterFormData | null;
  savedCoverLetterPayload: SavedCoverLetterPayload | null;
  onFormSubmit: (data: CoverLetterFormData) => void;
  onReset: () => void;
}

export function CoverLetterWorkflow(props: CoverLetterWorkflowProps) {
  // Move workflowId === "cover_letter" branches (~lines 393–395, 522–555, 556–620)
}
```

```typescript
// src/components/WorkflowView/workflows/CompanyResearchWorkflow.tsx
import React from "react";
import { CompanyResearchViz } from "@/components/companyResearch";
import { CompanyProfileViz } from "@/components/companyResearch/CompanyProfileViz";
import { RequestProfileBanner } from "@/components/companyResearch/RequestProfileBanner";
import { CompanyBrowser } from "@/components/companyResearch/CompanyBrowser";
import { PageHeader, MentorCard, FormCard } from "./shared";
import type { CompanyResearchResult } from "@/services/geminiService";
import type { CompanyProfile } from "@/types/companyProfile";

export interface CompanyResearchWorkflowProps {
  // All state variables from the workflowId === "company_research" branch
  companyResearch: CompanyResearchResult | null;
  companyProfile: CompanyProfile | null;
  // ... (inspect WorkflowView/index.tsx lines 735–888 for full list)
  config: any;
  formData: Record<string, any>;
  onInputChange: (key: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  profile: any;
}

export function CompanyResearchWorkflow(props: CompanyResearchWorkflowProps) {
  // Move workflowId === "company_research" branch (~lines 735–888)
}
```

```typescript
// src/components/WorkflowView/workflows/LinkedInWorkflow.tsx
import React from "react";
import { LinkedInUploadForm } from "@/components/LinkedInUploadForm";
import { LinkedInOptimizationWorkspace } from "@/components/LinkedInOptimizationWorkspace";
import { PageHeader } from "./shared";
import type { LinkedInAnalysisResult } from "@/services/geminiService";
import type { ScreenshotResult } from "@/services/linkedinScreenshotService";

export interface LinkedInWorkflowProps {
  submitted: boolean;
  linkedinResult: LinkedInAnalysisResult | null;
  isAnalyzing: boolean;
  isCapturing: boolean;
  screenshot: ScreenshotResult | null;
  linkedinUrl: string;
  linkedinFile: { file: File; objectUrl: string } | null;
  profile: any;
  config: any;
  onSubmit: (data: any) => void;
  onReset: () => void;
}

export function LinkedInWorkflow(props: LinkedInWorkflowProps) {
  // Move workflowId === "linkedin" branch (~lines 437–476)
}
```

```typescript
// src/components/WorkflowView/workflows/GenericWorkflow.tsx
import React from "react";
import { PageHeader, MentorCard, FormCard } from "./shared";
import Markdown from "react-markdown";
import type { WorkflowConfig } from "@/config/workflows";

export interface GenericWorkflowProps {
  config: WorkflowConfig;
  formData: Record<string, any>;
  fileData: Record<string, any>;
  isGenerating: boolean;
  mainDocumentText: string;
  onInputChange: (key: string, value: any) => void;
  onFileChange: (key: string, file: File) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GenericWorkflow(props: GenericWorkflowProps) {
  // Move the generic form→chat rendering block (the last fallback in WorkflowView,
  // roughly the non-workflow-specific path that uses config.fields + Markdown output)
}
```

- [ ] **Step 4: Rewrite `index.tsx` as thin dispatcher**

```typescript
// src/components/WorkflowView/index.tsx
import React, { useState, useRef, useEffect } from "react";
import { WorkflowId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";
import { useUserProfile } from "@/context/UserProfileContext";
// ... keep all the state hooks and handler functions
// ... import workflow components:
import { MarketWorkflow } from "./workflows/MarketWorkflow";
import { ResumeWorkflow } from "./workflows/ResumeWorkflow";
import { CoverLetterWorkflow } from "./workflows/CoverLetterWorkflow";
import { CompanyResearchWorkflow } from "./workflows/CompanyResearchWorkflow";
import { LinkedInWorkflow } from "./workflows/LinkedInWorkflow";
import { GenericWorkflow } from "./workflows/GenericWorkflow";
import type { ViewId } from "@/components/Sidebar";

export function WorkflowView({ workflowId, onNavigate }: { workflowId: WorkflowId; onNavigate?: (view: ViewId) => void }) {
  const config = workflowsConfig[workflowId];
  // ... all state declarations and handlers stay here ...

  if (workflowId === "goal_planning") return <GoalPlanningWrapper onNavigate={onNavigate} />;
  if (workflowId === "linkedin") return <LinkedInWorkflow ... />;
  if (workflowId === "resume_generation") return <ResumeWorkflow ... />;
  if (workflowId === "cover_letter") return <CoverLetterWorkflow ... />;
  if (workflowId === "market") return <MarketWorkflow ... />;
  if (workflowId === "company_research") return <CompanyResearchWorkflow ... />;
  return <GenericWorkflow ... />;
}
```

> Note: `goal_planning` renders `<GoalPlanningWorkspace>` directly — no new wrapper needed, just inline the existing import.

- [ ] **Step 5: Run checks**

```bash
npm run lint && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkflowView/
git commit -m "refactor: decompose WorkflowView into per-workflow components under workflows/"
```

---

## Final verification

- [ ] **Confirm no file over 400 lines**

```bash
wc -l src/components/DocumentEditor/index.tsx \
       src/components/ResumeGenerationForm/index.tsx \
       src/components/JobPostingsWorkspace/index.tsx \
       src/components/GoalPlanningWorkspace/index.tsx \
       src/components/WorkflowView/index.tsx
```

Expected: each under 400.

- [ ] **Confirm entry bundle size**

```bash
npm run build 2>&1 | grep "index-"
```

Expected: `dist/assets/index-*.js` gzipped size ≤ 150 KB.

- [ ] **Smoke test in browser**

Start the dev server and exercise the five changed views:
1. Open DocumentEditor via Resume Builder → verify toolbar, style panel, AI chat all work
2. Open ResumeGenerationForm → fill in each section, verify draft saves to localStorage
3. Open Job Postings → search, click a result, open detail drawer
4. Open Goal Planning → generate a plan, save it, reopen it
5. Open any workflow (e.g. Market Compensation) → submit form, verify output renders
