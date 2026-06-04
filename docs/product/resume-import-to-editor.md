# Resume Import → Document Editor

## Problem Statement
When a user uploads an existing resume (PDF/DOCX/TXT), the app should extract the real
content — contact info, summary, experience, education, skills — and drop it into the
Document Editor pre-formatted in a default template, ready to edit. Today, upload only
prefills form fields or the onboarding profile; there is no one-step "upload → editable,
templated document" path, and accuracy (no dropped or invented content) is the priority.

## User Stories
- **US-1** — As a job seeker, I upload my resume and immediately see it rendered as an
  editable document in a clean default template, so I can start improving it without
  retyping anything.
- **US-2** — As a user with a messy/2-column PDF, the importer still recovers my sections
  correctly, so layout quirks don't corrupt my content.
- **US-3** — As a privacy-conscious user, my resume text is only sent to the existing
  local Privacy Gateway for extraction, with nothing new persisted without my action.

## Acceptance Criteria (Given/When/Then)
- **AC-1** Given a valid PDF/DOCX/TXT resume, When I import it, Then the editor opens with
  my name as the title, and Summary/Experience/Education/Skills sections populated in the
  default template (`DEFAULT_STYLE_CONFIG.sectionOrder`).
- **AC-2** Given the source resume, When the document is assembled, Then every extracted
  bullet/responsibility appears verbatim — assembly is deterministic, **no second AI pass
  rewrites or invents content**.
- **AC-3** Given a field is absent in the source (e.g. no GitHub, no minor), When assembled,
  Then that field/line is simply omitted — no "undefined", "null", or empty headers.
- **AC-4** Given a file with <100 chars of extractable text or an unsupported type, When I
  import, Then I get a clear error and the option to paste text manually (existing pattern).
- **AC-5** Given extraction returns nothing usable, Then the user is told and can retry or
  proceed manually — no blank editor with a silent failure.
- **AC-6** The produced markdown round-trips through the editor's `markdownToHtml` grammar
  (`#`, `##`, `###`, `- `, `*em*`, `[text](url)`, `---`) without artifacts.

## Sprint Tasks
1. Deterministic serializer `profileToResumeMarkdown(profile, sectionOrder)` → editor markdown.
2. Orchestrator `importResumeToDocument(file)` = extract text → AI structured parse → serialize.
3. Harden the extraction prompt to preserve responsibilities/dates verbatim.
4. Provide the markdown to `ResumeGeneratorWorkspace` via the existing `initialResumeText` prop.
5. Type-check + edge-case validation.

## Non-Goals
- No new visual template designs (reuse existing `TEMPLATES` / `DEFAULT_STYLE_CONFIG`).
- No AI rewriting/scoring at import time (that's the separate Analyze flow).
- No change to onboarding's profile-extraction behavior.
- No new DB tables/migrations (import is in-memory until the user saves).

## Success Metrics
- % of imports that land in the editor with ≥3 populated sections (target >90% on real resumes).
- Zero content-loss / hallucination reports for the deterministic assembly step.
- Time-to-first-edit after upload < 10s.
