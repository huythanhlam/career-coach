# Rich Resume Editor — UX Design Spec

## Design Principles

1. **Content-first, style second** — AI generates content; design customization is a finishing layer, never the starting point.
2. **ATS guardrails** — visual choices that break ATS parsing are hidden behind an "Visual mode" toggle with a warning.
3. **Progressive complexity** — basic color/font options are always visible; advanced layout options are in a collapsible "Advanced" section.
4. **Mentor Mode alignment** — cream/terracotta/forest palette, Fraunces display font, warm card surfaces throughout.

---

## Overall Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: [Resume Builder] [Style ▾] [Layout ▾]  [Save] [DOCX] [PDF▸] [Exit]  │
├──────────────────┬──────────────────────────────┬───────────────┤
│                  │                              │               │
│   CHAT PANEL     │    RESUME CANVAS             │  STYLE PANEL  │
│   (unchanged)    │    (document view)           │  (collapsible)│
│                  │                              │               │
│   AI messages    │  ┌────────────────────────┐  │  Templates    │
│   + input        │  │  8.5×11 white page     │  │  Colors       │
│                  │  │  with live styling     │  │  Fonts        │
│                  │  └────────────────────────┘  │  Layout       │
│                  │                              │               │
└──────────────────┴──────────────────────────────┴───────────────┘
```

The Style Panel slides in from the right when the user clicks the "Style ▾" button in the header. It overlays on mobile, sits inline on desktop (≥1280px). The canvas remains visible and updates live as the user adjusts settings.

---

## Component Architecture

### `ResumeStyleConfig` (TypeScript interface — defines the entire style state)

```typescript
interface ResumeStyleConfig {
  templateId: string;               // e.g. "modern-clean", "tech-focused"
  accentColor: string;              // hex, e.g. "#2F6B4F"
  headingFont: GoogleFont;          // enum of 10 fonts
  bodyFont: GoogleFont;
  fontSize: "compact" | "normal" | "spacious";
  layout: "single" | "two-column";
  sidebarSections: string[];        // section keys in the sidebar column
  contactIcons: boolean;            // show Lucide icons next to contact info
  profilePhoto: {
    url: string | null;
    shape: "circle" | "rounded" | "square";
  };
  accentStyle: "line" | "filled" | "minimal"; // heading decoration style
}
```

---

## Screen 1 — Template Gallery (full-screen overlay)

**Trigger:** Click "Change Template" button (star icon) in the Style Panel, or on first entry to workspace.

```
┌─────────────────────────────────────────────────────────────────┐
│  ✕  Choose a template                           [ATS Safe only ◉]│
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┤
│      │      │      │      │      │      │      │      │        │
│ [T1] │ [T2] │ [T3] │ [T4] │ [T5] │ [T6] │ [T7] │ [T8] │  ...   │
│      │      │      │      │      │      │      │      │        │
│Modern│ Tech │Exec  │Creat │Photo │Acad  │Minim │Slate │        │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴────────┘
│  PREVIEW (right 55% of screen — shows actual resume content in hovered template) │
└─────────────────────────────────────────────────────────────────┘
```

**Interaction details:**
- Each template card = 160×210px thumbnail (A4 ratio). Rendered as a scaled-down `<div>` using `transform: scale(0.28)` inside a `160×210` clip container — actual resume DOM, not a static image.
- Hover on a card → the right 55% shows a full-resolution preview (the same live DOM at ~85% scale).
- Click → applies template, closes overlay with a slide-down animation.
- "ATS Safe only" toggle: hides templates with two-column layout or non-standard text flows.

**Template catalog (8 initial templates):**

| ID | Name | Key visual trait | ATS safe? |
|---|---|---|---|
| `modern-clean` | Modern & Clean | Left-aligned, thin rule under h2 | ✅ |
| `tech-focused` | Tech Focused | Monospace headings, indigo accents | ✅ |
| `executive` | Executive | Centered name, serif, wide margins | ✅ |
| `creative` | Creative | Gradient name, bold color accents | ⚠️ |
| `two-column` | Two-Column Pro | Sidebar with skills/contact | ⚠️ |
| `minimal` | Minimal | No lines, generous whitespace | ✅ |
| `slate` | Slate | Dark header band, white name reverse | ⚠️ |
| `academic` | Academic | Dense, gray h2 backgrounds | ✅ |

---

## Screen 2 — Style Panel (right sidebar, 280px wide)

Opens as a slide-in panel from the right edge. Has 4 collapsible sections:

### Section A — Colors

```
ACCENT COLOR
● ● ● ● ● ● ● ● ● ● ● ●   [# _______]
(12 swatches: terracotta, forest, slate, indigo, rose, amber,
 teal, navy, charcoal, burgundy, olive, custom hex)
```

Live-updates CSS custom property `--resume-accent` which all template styles read.

### Section B — Typography

```
HEADING FONT          BODY FONT
[Inter          ▾]    [Inter         ▾]

(Options: Inter, Merriweather, Playfair Display, Lato,
 Source Sans Pro, Montserrat, EB Garamond, Raleway,
 Crimson Text, DM Sans)

DENSITY
[Compact] [Normal ●] [Spacious]
```

Font options are Google Fonts — loaded dynamically via `<link>` injection to `<head>`. The picker shows a 2-word sample in each font.

### Section C — Layout & Sections

```
LAYOUT
[Single column ●]  [Two column]

SECTIONS (drag to reorder)
⠿ Contact
⠿ Summary
⠿ Experience  
⠿ Education
⠿ Skills
[+ Add section]
```

The drag handle (⠿) uses `@dnd-kit/sortable`. Dropping a section onto the "SIDEBAR" drop zone (visible only when two-column is selected) moves it to the sidebar column.

When "Two column" is active:
```
MAIN COLUMN        SIDEBAR
⠿ Experience      ⠿ Contact
⠿ Education       ⠿ Skills
⠿ Summary         [+ to sidebar]
```

### Section D — Details

```
PROFILE PHOTO
[  Upload photo  ]
( ) Circle  (●) Rounded  ( ) Square

CONTACT ICONS
[○] Show icons next to contact info
    email • phone • LinkedIn • GitHub

HEADING STYLE
(●) Line under  ( ) Filled bar  ( ) None

EXPORT MODE
[○] ATS Safe (clean text PDF)
[●] Visual (styled PDF — may reduce ATS score)
```

---

## Screen 3 — Add Custom Section Modal

Triggered by "+ Add section" in the Style Panel.

```
┌─────────────────────────────────────────┐
│  Add a section                       ✕  │
│                                         │
│  Section name                           │
│  [Certifications              ]         │
│                                         │
│  Quick-add:                             │
│  [Certifications] [Languages]           │
│  [Publications]   [Volunteering]        │
│  [Awards]         [Projects]            │
│                                         │
│  Content (optional — AI can fill this)  │
│  [                              ]       │
│                                         │
│          [Cancel]  [Add section ▸]      │
└─────────────────────────────────────────┘
```

---

## `ResumeStyleConfig` → CSS Variable Mapping

The `ResumeRenderer` receives `styleConfig` and injects CSS variables onto its root `<div>`:

```
--resume-accent       → accentColor
--resume-heading-font → headingFont (Google Font name)
--resume-body-font    → bodyFont
--resume-line-height  → 1.4 (compact) / 1.6 (normal) / 1.9 (spacious)
--resume-font-size    → 10pt / 11pt / 12pt
```

Template CSS files use `var(--resume-accent)` instead of hardcoded colors, enabling one-click re-theming without touching the template definition.

---

## Animation & Transition Specs

| Interaction | Animation |
|---|---|
| Style Panel open/close | `transform: translateX(280px → 0)` with `transition: 0.22s ease-out` |
| Template Gallery open | Fade + scale up: `opacity: 0 → 1`, `transform: scale(0.98 → 1)`, `0.18s ease-out` |
| Template apply | Canvas cross-fades with `opacity: 0 → 1` over `0.3s` |
| Color swatch select | Swatch scales `1 → 1.2` with `0.12s ease-out` |
| Resume content update | No animation (instant — preserves editing flow) |

---

## Mobile Responsiveness

- `< 768px`: Style Panel opens as a bottom sheet (80vh), canvas is full-width, chat panel hidden behind a tab.
- `768px–1280px`: Style Panel opens as an overlay (not inline), canvas at 100% width.
- `≥ 1280px`: Style Panel inline on the right (280px), canvas fills remaining space.

---

## Accessibility

- All swatches: `role="radio"` in a `role="radiogroup"`, `aria-label="Accent color: Forest Green"`.
- Template cards: `role="option"` in a `role="listbox"`, keyboard navigable with arrow keys.
- Drag handles: fallback keyboard reordering via up/down arrow keys when handle is focused.
- Profile photo upload: `aria-label="Upload profile photo"`, announces file name after selection.
- Style Panel toggle: `aria-expanded`, `aria-controls="style-panel"`.

---

## Files to Create / Modify

| File | Action | Notes |
|---|---|---|
| `src/types/resumeStyle.ts` | **Create** | `ResumeStyleConfig` interface + `DEFAULT_STYLE_CONFIG` constant |
| `src/components/TemplateGallery.tsx` | **Create** | Full-screen overlay, 8 template thumbnails, live preview |
| `src/components/StylePanel.tsx` | **Create** | Right sidebar: colors, fonts, layout, details sections |
| `src/components/ResumeCanvas.tsx` | **Create** | Wrapper that applies `styleConfig` CSS vars to `ResumeRenderer` |
| `src/components/SectionReorder.tsx` | **Create** | `@dnd-kit/sortable` drag list for section ordering |
| `src/components/AddSectionModal.tsx` | **Create** | Custom section builder modal |
| `src/components/ResumeGeneratorWorkspace.tsx` | **Modify** | Add `styleConfig` state, wire up `StylePanel` + `TemplateGallery`, pass config to canvas |
| `src/components/ResumeRenderer.tsx` | **Modify** | Accept `styleConfig` prop, inject CSS variables, support `two-column` layout mode |
| `src/types/userProfile.ts` | **Modify** | Add `styleConfig?: ResumeStyleConfig` to `SavedResume` type |

---

## Key Dependencies to Add

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
# For high-fidelity PDF (Sprint 4):
npm install @react-pdf/renderer
# OR for simpler approach:
npm install html2canvas jspdf
```

---

*Handoff to Senior Developer: Start with `src/types/resumeStyle.ts` (the interface), then `ResumeRenderer.tsx` modification (CSS variable injection + two-column layout), then `StylePanel.tsx`. The `TemplateGallery` live thumbnail approach (scaled-down actual DOM) is the highest-risk item — validate it works in Chrome/Safari before committing to it. Fallback is static SVG thumbnails.*
