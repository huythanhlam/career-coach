# Rich Resume Editor — Product Requirements

## Problem Statement

The current resume builder produces well-structured markdown which is rendered through a template system with limited visual customization. Users who care about visual differentiation — especially designers, marketers, PMs, and creative technologists — have no way to express personal brand through color, layout, typography, or visual elements. They abandon to Canva or Figma, losing the AI-assisted content entirely.

The goal is to bring Canva-like visual customization directly into the resume workspace without sacrificing the AI content generation that makes TechCoach unique.

---

## User Stories

**US-1 — Template Picker with Live Preview**
As a job seeker, I want to browse rich visual resume templates and see a live preview before committing, so I can choose a look that matches my industry and personal brand.

**US-2 — Color & Typography Customization**
As a user, I want to change the accent color, heading font, and body font of my resume, so it feels uniquely mine without requiring design skills.

**US-3 — Section Layout Control**
As a user, I want to switch between single-column and two-column layouts (e.g., sidebar for skills/contact, main column for experience), so I can control information density and visual hierarchy.

**US-4 — Icon Accents**
As a user, I want to add small icons next to contact info (email, phone, LinkedIn, GitHub) and section headings, so my resume feels modern and scannable.

**US-5 — Profile Photo**
As a user (especially for international markets where photos are expected), I want to upload a headshot that appears in a designated area of the template, with shape options (circle, square, rounded square).

**US-6 — Custom Sections**
As a user, I want to add non-standard sections (certifications, languages, volunteering, publications) and position them anywhere in the layout.

**US-7 — Export Fidelity**
As a user, I want the PDF export to look exactly like the on-screen preview — pixel-perfect, not a markdown printout.

**US-8 — Save Visual Variant**
As a user, I want to save multiple named visual variants of the same resume content (e.g., "Google Application — Blue Modern" vs "Startup Application — Creative"), so I can apply to different roles without redoing the design.

---

## Acceptance Criteria

### Template Picker
- **Given** I am on the resume workspace, **when** I click "Change Template," **then** a side panel opens showing ≥8 templates as thumbnail previews with my actual content rendered inside each.
- **Given** I hover a template thumbnail, **then** a full-page preview appears on the right side.
- **Given** I click a template, **then** the workspace updates instantly without reloading or losing content.

### Color Customization
- **Given** I open the Style panel, **when** I pick an accent color from a curated palette (12 colors + custom hex), **then** all template accents (borders, heading colors, rule lines) update live.
- **Given** I change the heading font, **then** all `h1`–`h3` elements in the preview update immediately using that font (sourced from Google Fonts, ≥10 options).

### Two-Column Layout
- **Given** I toggle "Two-column layout," **then** a sidebar column appears with Skills, Languages, and Contact info, and the main column shows Experience and Education.
- **Given** I drag a section chip from the main column to the sidebar, **then** that section moves instantly.

### Icon Accents
- **Given** I enable "Contact icons," **then** email, phone, LinkedIn, and GitHub entries in the contact block display a matching icon inline.
- Icons must be from a curated SVG set (Lucide), not user-uploadable images, to prevent misuse.

### Profile Photo
- **Given** I upload a photo ≤5MB (JPG/PNG/WEBP), **then** it appears in the template's photo slot.
- **Given** I choose a shape, **then** the photo is clipped to circle, square, or rounded-square using CSS `clip-path`/`border-radius`.
- Photo is stored in Supabase Storage under `user-assets/{userId}/profile-photo`.

### Export Fidelity
- PDF export uses `@react-pdf/renderer` (or html-to-image + jsPDF) to produce an actual vector PDF, not a browser print dialog.
- PDF dimensions: US Letter (8.5×11in) at 96dpi equivalent.
- All custom fonts loaded from Google Fonts CDN must be embedded via `@font-face` in the PDF.

### Save Variants
- **Given** I click "Save variant," **then** the current `resumeText` + `styleConfig` (template id, accent color, fonts, layout) is saved to `savedResumes[]` in the user's Supabase profile.
- Variants are listed in the workspace header as named tabs.

---

## Sprint Task Breakdown

### Sprint 1 — Foundation (1 week)
- [ ] Define `ResumeStyleConfig` TypeScript interface
- [ ] Upgrade `ResumeRenderer` to accept `styleConfig` prop and render CSS variables accordingly
- [ ] Build `TemplateGallery` component: 8 templates as thumbnail cards with hover preview
- [ ] Implement accent color picker (12-color palette + hex input) wired to live preview

### Sprint 2 — Layout & Typography (1 week)
- [ ] Build two-column layout engine in `ResumeRenderer`
- [ ] Drag-and-drop section reordering (using `@dnd-kit/core`)
- [ ] Google Fonts integration: font picker with 10 options, dynamic `<link>` injection
- [ ] Heading size slider (compact / normal / spacious)

### Sprint 3 — Rich Elements (1 week)
- [ ] Contact icon accents (Lucide icons, toggle on/off per field)
- [ ] Profile photo upload: Supabase Storage upload, shape picker, `clip-path` rendering
- [ ] Custom section builder: add named section, choose position, add content via AI or manually

### Sprint 4 — Export & Save (1 week)
- [ ] High-fidelity PDF export using `@react-pdf/renderer` or html-to-image + jsPDF
- [ ] DOCX export preserving two-column layout as best-effort
- [ ] Save/load style variants alongside `savedResumes`
- [ ] Migrate existing saved resumes to include `styleConfig: null` (backward compatible)

---

## Non-Goals

- **No freeform canvas drag-drop** (like Canva's x/y positioning of text boxes) — resumes need a fixed document flow to remain ATS-parseable. Sections are reorderable but not freely positioned.
- **No image insertion beyond profile photo** — arbitrary image uploads (logos, backgrounds, decorative images) introduce ATS parsing problems and file size issues.
- **No shape drawing tools** — decorative shapes other than template-provided dividers/accents.
- **No collaborative editing** — real-time multi-user editing is out of scope.
- **No custom CSS input** — users get a controlled palette, not a CSS editor.

---

## Success Metrics

| Metric | Target |
|---|---|
| Template selection rate (% of resumes using non-default template) | ≥ 40% |
| Style customization rate (% that change ≥1 style option) | ≥ 25% |
| PDF export satisfaction (rating in post-export survey) | ≥ 4.2/5 |
| Time to first styled resume | ≤ 3 minutes from template picker |
| Abandonment to Canva (self-reported) | ≤ 10% |

---

## Open Questions

1. Should we support ATS-safe vs visual modes? (ATS mode = clean markdown PDF; visual mode = rich but possibly harder to parse)
2. Do we ship with `@react-pdf/renderer` (complex, full control) or html-to-image (simpler, less control over multi-page breaks)?
3. Profile photo — opt-in by template, or always available? Some hiring managers in the US dislike photos due to bias concerns.

---

*Handoff to UX Designer: The two key interaction surfaces are (1) the Style Panel (right sidebar when in editor) and (2) the Template Gallery (full-screen overlay or split view). The designer should spec both, plus the two-column layout toggle and section drag handles. The `ResumeStyleConfig` interface shape should inform the component API.*
