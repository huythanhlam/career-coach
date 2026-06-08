# Career Coach AI — Product Requirements Document

## 1. Product Vision

**Career Coach AI** is a local-first, AI-powered career coaching platform for technology professionals. It replaces expensive human coaches and scattered productivity tools with a single, opinionated workspace that guides users from job search through offer negotiation. The design philosophy is warm and mentor-like ("Mentor mode") — encouraging and specific, never corporate-fluffy.

**Core value proposition:** Give every tech professional access to an elite career coach in their pocket — one that knows market compensation data, can audit resumes in seconds, runs mock interviews, and adapts to the user's specific target role and experience level.

---

## 2. Target Users

| Segment | Description |
|---|---|
| **Mid-career engineers** | 3–8 YOE, looking to jump from IC to senior or staff |
| **Career switchers** | Pivoting into PM, data, or engineering from adjacent fields |
| **Active job seekers** | Actively interviewing at 3–10 companies simultaneously |
| **Negotiators** | Have an offer in hand and want to maximize total compensation |

---

## 3. Tech Stack

### Frontend
| Library | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 6.2 | Dev server and build |
| Tailwind CSS | 4.1 | Styling via CSS custom properties |
| `@tailwindcss/typography` | latest | Prose/markdown rendering |
| shadcn/ui (Base UI) | latest | Headless UI primitives |
| `lucide-react` | latest | Icon library |
| `react-markdown` + `rehype-raw` | latest | Markdown rendering with raw HTML passthrough |
| `recharts` | latest | Data visualization (compensation charts) |
| `react-pdf` | latest | In-page PDF preview |
| `motion` | latest | Animation primitives |
| `class-variance-authority` | latest | Button/variant styling helper |
| `@fontsource-variable/geist` | latest | Geist Variable body font |
| Google Fonts — Fraunces | via CDN | Display/heading serif font |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | Local AI gateway server on port 4000 |
| `@google/genai` SDK | Gemini API integration |
| TypeScript (`tsx`) | Server runtime |

### AI
- **Model (default):** `gemini-1.5-flash`
- **Model (resume analysis):** `gemini-1.5-pro`
- **Pattern:** Local Express gateway at `http://localhost:4000/api/ai/generate` receives `{ systemInstruction, prompt, model }` and returns streamed text
- **Streaming:** All UI responses stream token-by-token via callback

---

## 4. Design System — Mentor Mode

### Color Tokens (CSS custom properties in `:root`)

```css
--background: #FBF7F1;   /* cream */
--paper:      #F4EEE3;   /* warm paper */
--card:       #FFFFFF;
--muted:      #F0E9DC;

--foreground:       #1F1B16;  /* warm near-black */
--card-foreground:  #1F1B16;
--muted-foreground: #6E6557;  /* warm stone */

--primary:            #D97757;  /* terracotta — CTAs, AI highlights */
--primary-foreground: #FFFFFF;

--forest: #2F6B4F;   /* success states, secondary accents */
--highlight: #E8B948; /* marigold — small wins, tips */

--secondary:            #F0E9DC;
--secondary-foreground: #1F1B16;
--accent:               #F0E9DC;
--accent-foreground:    #1F1B16;

--destructive:            #F43F5E;
--destructive-foreground: #FFFFFF;

--popover:            #FFFFFF;
--popover-foreground: #1F1B16;

--border: #E8DFCE;
--input:  #E8DFCE;
--ring:   #D97757;
--radius: 0.75rem;

/* Status colors — never change these */
--status-applied:      #3B82F6;
--status-interviewing: #F59E0B;
--status-offer:        #10B981;
--status-rejected:     #F43F5E;
```

### Typography
- **Display headings:** `font-family: 'Fraunces', Georgia, serif` via `.font-display` utility class
- **Body / UI:** `'Geist Variable', sans-serif`
- **Code / monospace:** `ui-monospace, monospace`

### Component Patterns
- **Cards:** `background: var(--card)`, `border: 1px solid var(--border)`, `border-radius: 24px`, `box-shadow: 0 8px 30px rgba(0,0,0,0.04)`
- **Buttons (primary):** `background: var(--primary)`, `color: #FFF`, `height: 44–52px`, `border-radius: 12–14px`, `font-weight: 600`
- **Inputs:** `background: var(--muted)`, `border: 1px solid var(--border)`, `height: 48px`, `border-radius: 12px`
- **Section headings:** Fraunces serif, 24–32px, `font-weight: 600`
- **Eyebrow labels:** `font-size: 10px`, `font-weight: 900`, `text-transform: uppercase`, `letter-spacing: 0.25em`
- **Status pills:** inline `border-radius: 9999px`, 10px font, using status color map above
- No dark mode. No glassmorphism. No indigo. Warm tones only.

### Tailwind Theme Mapping
All CSS variables must be mapped in an `@theme inline` block so Tailwind utilities like `bg-primary`, `text-foreground`, `border-border` resolve to the CSS custom properties.

---

## 5. Application Architecture

### File Structure
```
/
├── index.html                        # Fraunces Google Fonts CDN link here
├── server.ts                         # Express AI gateway
├── src/
│   ├── App.tsx                       # Root router
│   ├── index.css                     # Design tokens + @theme + utilities
│   ├── config/
│   │   └── workflows.ts              # All 12 workflow configs
│   ├── services/
│   │   └── geminiService.ts          # AI service layer
│   └── components/
│       ├── Sidebar.tsx
│       ├── Dashboard.tsx
│       ├── UnifiedWorkspace.tsx
│       ├── WorkflowView.tsx
│       ├── GlobalChatPanel.tsx
│       ├── MarketCompensationViz.tsx
│       ├── ResumeWorkspace.tsx
│       ├── ResumeGeneratorWorkspace.tsx
│       ├── ResumeGenerationForm.tsx
│       ├── ResumeRenderer.tsx
│       └── ui/                       # shadcn/ui primitives
```

### Routing
Single-page application with no URL routing — navigation is managed via `activeView: ViewId` state in `App.tsx`.

```typescript
type ViewId =
  | "dashboard"
  | "unified"
  | "linkedin"
  | "resume"
  | "resume_generation"
  | "salary"
  | "interview"
  | "market"
  | "career"
  | "company_research"
  | "mock_behavioral"
  | "mock_case_study"
  | "mock_tech";
```

---

## 6. Layout — Sidebar

Fixed 280px left panel, always visible.

### Brand Mark
- Compass icon in `rgba(217,119,87,0.15)` rounded box
- "Career Coach AI" in Fraunces serif, 17px, `font-weight: 600`
- Italic `"AI"` span in `var(--primary)` terracotta
- Eyebrow label: "Mentor mode" in muted stone

### "New plan" CTA
- Full-width dark button (`var(--foreground)` bg, cream text)
- Navigates to `unified` view

### Navigation Groups

| Group | Items | ViewId |
|---|---|---|
| **Plan** | Overview, Strategy Engine, Career Roadmap | `dashboard`, `unified`, `career` |
| **Apply** | Resume Builder, Cover Letter, LinkedIn Optimization | `resume_generation`, `cover_letter`, `linkedin` |
| **Practice** | Behavioral Sim, Technical Sim, Case Study | `mock_behavioral`, `mock_tech`, `mock_case_study` |
| **Research** | Company Intel, Market Data, Salary Negotiator | `company_research`, `market`, `salary` |

**Active state:** White card bg + 3px left terracotta bar + terracotta icon + terracotta text label

### User Footer
- "HL" initials in terracotta circle
- "Huy Lam" name
- "Senior PM track" subtitle in muted

---

## 7. Dashboard

### Hero Card (full width, dark bg `var(--foreground)`)
- Greeting: "Hey Huy 👋" in Fraunces
- Subtitle callout: "Your Stripe interview is in two days." with marigold `var(--highlight)` accent
- Two CTA buttons: "Resume Workspace" → `resume` view, "Strategy Engine" → `unified` view

### Stats (right side of hero)
Two metric cards:
1. **"Your week"** — active conversations count, breakdown: X onsite / X phone screen
2. **"Reply rate"** — 15% vs 12% benchmark, with forest/marigold gradient progress bar

### Application Pipeline Table
| Column | Type |
|---|---|
| Company · Role | Avatar initials (2 chars) + company name + role title |
| Location | Text |
| Applied | Date string |
| Status | Color-coded pill |

Status pill colors: `applied` = blue, `interviewing` = amber, `offer` = emerald, `rejected` = rose

**"Add Application" modal:** Company, Role, Location, Date, Status fields.

**Sample data pre-loaded:**
- Stripe — Senior PM — San Francisco — Interviewing
- Anthropic — PM — San Francisco — Applied
- Vercel — Product Lead — Remote — Offer
- Figma — Group PM — New York — Rejected

### Quick Tools Section
Three action cards in a row:
1. **Resume Builder** — `FileText` icon — "Last session: 2 days ago" — → `resume_generation`
2. **Impact Audit** — `Sparkles` icon — "3 improvements found" — → `resume`
3. **Behavioral Sim** — `MessageSquare` icon — "8 questions practiced" — → `mock_behavioral`

---

## 8. Global AI Chat Panel

A 400px slide-in panel from the right edge, toggled by a floating action button (FAB).

### FAB
- `bottom: 24px`, `right: 28px`, fixed position
- `var(--primary)` terracotta background, white `MessageCircle` icon
- Forest green pulsing badge dot at top-right
- `box-shadow: 0 12px 30px rgba(217,119,87,0.35)`
- Hidden when panel is open

### Panel Header
- Terracotta `Sparkles` icon, "The Coach" title
- Status chip: "● Listening · [Active Workflow Name]"
- Close X button

### Message Bubbles
- **User:** Right-aligned, `background: var(--primary)`, white text
- **Coach:** Left-aligned, `background: var(--muted)`, foreground text, `Sparkles` icon avatar
- User avatar: "HL" initials in terracotta circle

### Empty State
When `messages.length < 2`, show 3 workflow-specific suggested prompt chips.

### Input Bar
`var(--muted)` bg, `var(--border)` border, placeholder "Ask your coach anything…", terracotta send button.

### AI Behavior
System instruction pulled from `workflowsConfig[activeView]?.systemInstruction` or falls back to base TechCoach persona. Multi-turn streaming conversation via `createTechCoachChat` + `sendMessageStream`.

---

## 9. AI Service Layer (`geminiService.ts`)

### Base Persona (injected into all workflows)
```
You are 'TechCoach AI,' an elite, highly empathetic, and strategically brilliant career coach specializing in the technology sector (software engineering, product management, data science, and IT). Your goal is to help users land their ideal tech jobs, maximize their compensation, and build sustainable career paths. Tone: Professional, encouraging, realistic, and highly actionable. Do not use corporate fluff. Provide specific, data-backed advice. Never guarantee a job placement or a specific salary; frame advice as maximizing probability and competitive positioning.
```

### Gateway API
```
POST http://localhost:4000/api/ai/generate
Body: { systemInstruction: string, prompt: string, model?: string }
Response: { text: string }
```

### Key Functions
| Function | Signature | Description |
|---|---|---|
| `generateWorkflowData` | `(sysInstr, prompt, model?) => Promise<string>` | One-shot generation |
| `analyzeResume` | `(sysInstr, prompt) => Promise<{ resumeText, annotations }>` | Resume analysis with JSON parsing |
| `suggestWorkExperienceBullets` | `(jobTitle, targetRole) => Promise<string>` | XYZ-formula bullet generation |
| `createTechCoachChat` | `(sysInstr, enableSearch?) => Chat` | Multi-turn chat factory |
| `sendMessageStream` | `(chat, message, onChunk) => Promise<void>` | Streaming message handler |

---

## 10. Workflow Configuration (`workflows.ts`)

### Shared Data

#### COMMON_ROLES
```
Software Engineer, Frontend Engineer, Backend Engineer, Full Stack Engineer,
Product Manager, Data Scientist, Data Engineer, Machine Learning Engineer,
DevOps/Platform Engineer, Engineering Manager, UX/UI Designer, QA Engineer, Other
```

#### COMMON_LOCATIONS
```
San Francisco CA, New York NY, Seattle WA, Austin TX, Boston MA,
Los Angeles CA, London UK, Remote (US), Other
```

### Workflow Schema
```typescript
interface WorkflowConfig {
  id: string;
  title: string;
  description: string;
  systemInstruction: string;
  fields: FormField[];
  enableSearch?: boolean;
  generatePrompt: (data: Record<string, any>) => string;
  suggestedPrompts?: string[];
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "file" | "url" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  allowCustom?: boolean;
}
```

---

## 11. The 12 Workflows

### 11.1 LinkedIn Profile Optimization (`linkedin`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| LinkedIn URL | `url` | No |
| Profile Text (headline + summary + experience) | `textarea` | Yes (if no URL) |

**System Instruction:**
> You are an expert LinkedIn profile optimizer and personal branding strategist for tech professionals. Analyze the profile and provide a comprehensive optimization report including: (1) overall profile strength score /100, (2) specific rewrites for headline, summary/About, each experience entry, skills section, and recommendations section. Format output as structured Markdown with clear before/after examples. Focus on: keyword density for ATS/recruiter search, quantified achievement statements using the XYZ formula (Accomplished [X] as measured by [Y] by doing [Z]), and professional storytelling arc.

**Output:** Structured Markdown — Profile Score, Headline rewrite, About rewrite, Experience rewrites, Keywords to add, Skills optimization.

**Suggested Prompts:** "How can I make my headline stand out more to recruiters?", "Can you rewrite my 'About' section to sound more impactful?", "What keywords am I missing for a Senior Engineer role?"

---

### 11.2 Resume Impact Audit (`resume`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Resume | `file` (PDF/DOCX) or `textarea` | Yes |
| Job Description | `url` or `textarea` | No |

**System Instruction:**
> You are an expert ATS resume analyst and career strategist. Analyze the resume using the XYZ Achievement Formula (Accomplished [X] as measured by [Y] by doing [Z]). Return a JSON response in this EXACT format: `{ "resumeText": "full resume as clean markdown", "annotations": [{ "textToHighlight": "exact phrase from resume", "type": "strength" | "weakness", "suggestion": "specific improvement" }] }`. Annotations must reference exact verbatim substrings that exist in the resumeText. Provide 4–8 annotations balancing strengths and weaknesses.

**Output:** JSON `{ resumeText: string, annotations: Annotation[] }` → transitions to `ResumeWorkspace`

```typescript
interface Annotation {
  textToHighlight: string;  // exact verbatim substring from resumeText
  type: "strength" | "weakness";
  suggestion: string;
}
```

**Model:** `gemini-1.5-pro`

**Suggested Prompts:** "How can I improve my bullet points?", "What skills am I missing for this role?", "How does my resume compare to top candidates?"

---

### 11.3 Salary Negotiation Strategist (`salary`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Offer Letter | `file` (PDF) | No |
| Offer Details | `textarea` | No |
| Target Compensation | `text` | **Yes** |

**System Instruction:**
> You are an elite salary negotiation strategist specializing in tech compensation packages. Analyze the total compensation (base, bonus, equity, sign-on, benefits), provide a negotiation strategy report, draft 2–3 negotiation email templates for different scenarios (push for base, push for equity, push for sign-on), and provide phone script talking points. Include: market benchmarks for the role, specific counter-offer ranges, negotiation tactics ranked by likelihood of success, and red lines not to cross. Be tactical and direct.

**Output:** Structured Markdown — TC Breakdown, Market Benchmark, Negotiation Strategy, Email Templates, Phone Script.

**Suggested Prompts:** "Can you draft an email asking for a higher signing bonus?", "What's the best way to ask for more equity?", "How do I negotiate without risking the offer?"

---

### 11.4 Interview & Job Search Guide (`interview`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Job Description URL | `url` | No |
| Target Role | `select` (COMMON_ROLES) | **Yes** |
| Specific Focus / Request | `textarea` | No |

**System Instruction:**
> You are an expert tech interview coach and job search strategist. For the given role and JD, provide: (1) top 10 behavioral questions with STAR-method answer frameworks, (2) top 10 technical screening questions with expected answer depth, (3) a 1/3/5/10-week structured job search and interview prep schedule, (4) recommended certifications or skills to add within 30/60/90 days, (5) insider tips for getting past the ATS and recruiter screen stage. Format as actionable Markdown with clear headers and checklists.

**Search enabled:** Yes

**Suggested Prompts:** "What are the most common technical questions for this role?", "Can you give me a 4-week study plan?", "What should I research about the company before the interview?"

---

### 11.5 Market Compensation Analyst (`market`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Target Role | `select` (COMMON_ROLES) | **Yes** |
| Primary Location | `select` (COMMON_LOCATIONS) | **Yes** |
| Secondary Location (comparison) | `select` (COMMON_LOCATIONS) | No |
| Years of Experience | `text` | **Yes** |

**System Instruction:**
> You are a world-class compensation data analyst specializing in tech industry salaries. Return ONLY a valid JSON object (no markdown wrapper) using the exact schema below. Use real 2024 market data. YoY trends must reflect real market dynamics (2021 tech boom spike, 2022–2023 correction, 2024 stabilization). Cost of living estimates must be realistic monthly USD values for the specific city.

**Output JSON Schema:**
```json
{
  "summary": "2–3 sentence overview",
  "locations": [
    {
      "locationName": "San Francisco, CA",
      "salaryBands": { "min": 140000, "q1": 165000, "median": 195000, "q3": 230000, "max": 280000 },
      "totalCompensation": {
        "baseMedian": 195000, "bonusMedian": 25000, "equityMedian": 60000,
        "signOnMedian": 20000, "totalEstimated": 300000,
        "notes": "Equity vests over 4 years with 1-year cliff"
      },
      "salaryHistogram": [
        { "bucket": "120k-140k", "percentage": 5 },
        { "bucket": "140k-160k", "percentage": 12 }
      ],
      "equity": "RSUs typical at mid-to-senior; seed startups offer 0.1–0.5%",
      "yoyTrend": [
        { "year": "2020", "compensation": 165000 },
        { "year": "2021", "compensation": 185000 },
        { "year": "2022", "compensation": 210000 },
        { "year": "2023", "compensation": 195000 },
        { "year": "2024", "compensation": 200000 }
      ],
      "costOfLiving": {
        "housing": 3500, "utilities": 150, "gas": 200, "groceries": 600,
        "dining": 500, "transportation": 200, "healthcare": 300,
        "effectiveDisposableIncome": 7500
      }
    }
  ],
  "sources": ["https://levels.fyi", "https://glassdoor.com"]
}
```

**Constraints:** Histogram bucket labels must be identical strings across locations. YoY years must be consistent. All cost-of-living values are monthly USD.

**Search enabled:** Yes

**UI Rendering (MarketCompensationViz component):**
- Summary header card
- Salary bands: 3 stat cards for single location (Median Base, Effective Income, Total TC); 2 side-by-side comparison cards for dual-location
- Histogram/range bar chart (recharts `BarChart`)
- Cost of Living breakdown bar chart + data table
- YoY Trend line chart (recharts `LineChart`)
- Data sources links
- Chart colors: primary location = terracotta `#D97757`, secondary = forest `#2F6B4F`

**Suggested Prompts:** "How does this compare to remote roles?", "What equity should I expect at a Series B?", "How has compensation changed since the 2022 layoffs?"

---

### 11.6 Career Path Cartographer (`career`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Current Role | `select` (COMMON_ROLES) | **Yes** |
| Ultimate Career Goal | `select` (COMMON_ROLES + Director/VP/CTO options) | **Yes** |

**System Instruction:**
> You are a strategic career advisor specializing in tech career trajectories. Build a detailed career roadmap covering: (1) 3/5/10-year milestones with specific job titles at each stage, (2) critical skills and certifications to acquire at each stage, (3) typical company types and sizes to target at each stage, (4) IC vs management track analysis with pros/cons for this specific path, (5) salary progression expected at each milestone, (6) 3 specific action items to take in the next 90 days. Format as structured Markdown with timelines.

**Suggested Prompts:** "What certifications would most accelerate this path?", "Should I go management or stay IC?", "What companies are best for this trajectory?"

---

### 11.7 Company Research & Intel (`company_research`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Job Description URL | `url` | No |
| Company Name | `text` | **Yes** |
| Target Role | `select` (COMMON_ROLES) | **Yes** |

**System Instruction:**
> You are a corporate intelligence analyst and interview strategist. For the given company and role, provide: (1) company overview (funding stage, market position, recent news, growth trajectory), (2) culture analysis (Glassdoor/Blind sentiment summary, common praises and complaints), (3) interview process breakdown (typical stages, what each round tests), (4) 10 insider interview questions tailored to this role at this company, (5) 5 smart questions the candidate should ask, (6) red flags to watch for, (7) how to make a memorable impression. Use real, current information.

**Search enabled:** Yes

**Suggested Prompts:** "What are the biggest red flags I should watch for?", "What recent news should I mention in the interview?", "How does the culture compare to competitors?"

---

### 11.8 Mock Behavioral Interview (`mock_behavioral`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Job Description URL | `url` | No |
| Target Role | `select` (COMMON_ROLES) | **Yes** |
| Focus Area | `select` | **Yes** |

**Focus Area options:** Leadership, Conflict Resolution, Time Management, Adaptability, Communication, Teamwork, Problem-Solving, Other

**System Instruction:**
> You are a senior tech interviewer conducting a behavioral interview. Ask one behavioral question at a time. After the candidate responds, provide structured feedback: (1) STAR score (Situation/Task/Action/Result completeness, 1–5), (2) what they did well, (3) specific improvements, (4) an example of a stronger answer structure. Then ask the next question. Keep questions relevant to the focus area and target role. Start immediately with the first question — no preamble.

**Search enabled:** Yes

**Interaction pattern:** Turn-by-turn. AI asks → user answers → AI gives STAR feedback → AI asks next question.

**Suggested Prompts:** "Can you ask harder questions?", "Give me more detailed feedback on my last answer.", "Focus on leadership questions only."

---

### 11.9 Mock Case Study & Design Test (`mock_case_study`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Job Description URL | `url` | No |
| Target Role | `select` (COMMON_ROLES) | **Yes** |
| Case Study Topic | `select` | **Yes** |

**Case Study Topic options:** Product Strategy, Product Design, Metrics & Analytics, Go-to-Market, Growth & Acquisition, Other

**System Instruction:**
> You are a senior product interviewer running a case study interview. Present a realistic case prompt relevant to the topic and role. Guide the candidate through: (1) clarifying questions phase (prompt them if they skip it), (2) framework structuring, (3) solution design/analysis, (4) metrics and success criteria, (5) tradeoff discussion. After each phase give brief feedback and guide them to the next. End with a summary score and top improvements. Start with the case prompt immediately.

**Search enabled:** Yes

**Suggested Prompts:** "Can you give me a hint on how to structure this?", "Let's move on to the metrics phase.", "Give me feedback on my solution so far."

---

### 11.10 Mock Technical Interview (`mock_tech`)

**Form Fields:**
| Field | Type | Required |
|---|---|---|
| Job Description URL | `url` | No |
| Interview Type | `select` | **Yes** |
| Seniority Level | `select` | **Yes** |

**Interview Type options:** System Design, Coding/Algorithms, AI/ML Concepts, Frontend Architecture, Backend Architecture, Database Design, Other

**Seniority Level options:** Intern, Junior (0–2 YOE), Mid-level (2–5 YOE), Senior (5–8 YOE), Staff/Principal (8+ YOE)

**System Instruction:**
> You are a senior technical interviewer at a top-tier tech company (FAANG-level). Present a technical problem appropriate for the seniority level and interview type. For system design: ask the candidate to walk through requirements, capacity estimation, high-level design, deep-dive on one component, and tradeoffs. For coding: give the problem, ask them to talk through their approach before coding, probe for edge cases, then ask about time/space complexity. Give calibrated feedback after each response. Start with the problem immediately.

**Search enabled:** Yes

**Suggested Prompts:** "I'm stuck — can you give me a hint?", "Let's go deeper on the database design.", "Evaluate my solution so far."

---

### 11.11 Resume Generator (`resume_generation`)

Custom multi-step UI — does NOT use the generic `WorkflowView`.

#### Step 1 — Template Selection
Six resume templates with mini-preview thumbnails rendered as component `MiniTemplatePreview`:

| Template ID | Visual Style |
|---|---|
| `Modern & Clean` | Two-column, professional, white bg, terracotta accent bars |
| `Tech Focused` | Dark terminal `#0d1117` bg, monospace font, macOS traffic-light dots |
| `Executive` | Centered header, bold full-width divider rule, serif |
| `Creative / Portfolio` | Gradient avatar, portfolio grid preview, warm `#fdfbf7` bg |
| `Photography / Visual` | Dark masonry grid `bg-zinc-950` |
| `Academic / Research` | Citation-style with left border accent |

Template card active state: `border: 2px solid var(--primary)`, `box-shadow: 0 0 0 3px rgba(217,119,87,0.12)`

#### Step 2 — Details Form

**Guidance tip card** (marigold `rgba(232,185,72,0.08)` bg): Explains what happens next and pro tips.

**Form sections:**

1. **Target Setup** (terracotta `rgba(217,119,87,0.05)` accent card):
   - Selected Template (read-only display)
   - Target Role (select COMMON_ROLES, required)

2. **Personal Information** (grid 2-col):
   - Full Name (required), Email (required), Phone, LinkedIn URL, GitHub URL, Portfolio URL

3. **Work History** (repeatable, minimum 1):
   - Job Title/Role (required on first), Company Name, Start Date, End Date
   - Responsibilities & Achievements (textarea)
   - "Auto-suggest bullets" button → `suggestWorkExperienceBullets(role, targetRole)` → appends XYZ bullets

4. **Education** (repeatable, minimum 1):
   - Institution (required on first), Degree/Field, Graduation Year

5. **Skills:**
   - Comma-separated textarea

**Submit button:** `var(--foreground)` dark bg, "Generate Resume Workspace"

#### Resume Generation Workspace (`ResumeGeneratorWorkspace`)

After form submission:

- **Left mini toolbar** (dark `var(--foreground)` bg): "Coach" (Sparkles) and "Editor" (Edit3) toggle tabs
- **Center canvas:** Live `ResumeRenderer`, max-width 850px, `var(--card)` bg with shadow
- **Right panel — AI Assistant tab:**
  - Streaming chat; AI messages replace ` ```markdown...``` ` blocks with "*(Updated the resume)*"
  - "Target Bullet/Section" optional scoping input
  - Chat textarea + terracotta send button
- **Right panel — Raw Editor tab:**
  - Full Markdown source textarea, synced to canvas

**System Instruction:**
> You are an expert resume writer specializing in tech industry resumes. Generate a professional, ATS-optimized resume based on the provided details. Use the XYZ Achievement Formula wherever possible. If responsibilities are left blank for a job, generate 3–4 realistic, metric-driven achievement bullets based on the job title and company type. Format the resume in clean Markdown. When you provide the resume, wrap it ENTIRELY in \`\`\`markdown\n...\n\`\`\` so the system can parse it. If answering a follow-up question only, do NOT use the markdown block unless you are updating the resume.

**Export:** PDF (`window.print`) and DOCX (HTML data URL download as `.doc`)

---

### 11.12 Strategy Engine — Unified Workspace (`unified`)

Custom 3-step intake → parallel 4-analysis results. Does NOT use generic `WorkflowView`.

#### Intake Form (3 steps)
1. **Target** — text: "What role are you targeting?" (e.g., "Senior Software Engineer at Stripe")
2. **Experience** — YOE number input + level select (Entry-level / Mid-level / Senior / Staff / Principal / Manager)
3. **Resume** — drag-and-drop PDF/DOCX upload with file preview, or skip

#### Processing State
Four parallel spinner cards with labels:
1. "Analyzing market compensation…"
2. "Researching company intelligence…"
3. "Evaluating resume fit…"
4. "Building interview strategy…"

Each transitions from spinner to `CheckCircle2` (forest green) when its AI call completes.

#### Results Grid (2×2 bento)
| Card | Content |
|---|---|
| **Market Compensation** | Full `MarketCompensationViz` component |
| **Company Intel** | Markdown card: culture, Glassdoor summary, recent news |
| **Resume Fit** | Bulleted strengths/gaps analysis vs target role |
| **Interview Strategy** | Full-width: top 10 Qs, 4-week prep schedule, certifications |

#### Persistence
- "Save this analysis" → stores to `localStorage` key `tc_saved_analyses` with timestamp ID
- "Load previous" dropdown → restores full results from any prior save

---

## 12. Resume Workspace (`ResumeWorkspace`)

Entered from Impact Audit (`resume`) after AI analysis completes.

### Layout
- **Header bar:** "Impact Audit" in Fraunces + save status + DOCX/PDF export + Exit
- **Left mini toolbar** (dark `var(--foreground)` bg): "Report" (Eye) and "Editor" (Edit3) tabs
- **Center canvas:** `ResumeRenderer` with inline `<mark>` highlights; max-width 850px
- **Right panel:** Annotation suggestions list OR raw Markdown editor

### Annotation Highlighting
Phrases matching `annotation.textToHighlight` are wrapped in `<mark data-annotation-index="N">`. Custom `mark` component in `ResumeRenderer`:
- **Strength:** `bg-green-100 text-green-900 border-b-2 border-green-500`
- **Weakness:** `rgba(217,119,87,0.10)` bg, terracotta `var(--primary)` bottom border
- Click → selects annotation in right panel, auto-switches to Suggestions tab

### Suggestions Panel
- Stats row: Strengths count card (forest green) + Suggestions count card (terracotta)
- Annotation cards: type badge pill, quoted phrase in monospace, suggestion text
- Selected card: `border: 1px solid var(--primary)`, `box-shadow: 0 0 0 1px var(--primary)`

### Editor Panel
Raw Markdown textarea synced to canvas in real time. Auto-save debounce 1s.

### Export
- **PDF:** `window.print()` with `@media print` styles hiding all chrome
- **DOCX:** Wraps in Word-compatible HTML, downloads as `.doc`

---

## 13. Resume Renderer (`ResumeRenderer`)

Renders Markdown resume text with template-specific Tailwind Typography prose classes.

| Template | Key Prose Classes |
|---|---|
| Modern & Clean | `prose-zinc`, `prose-h2:border-b-2 prose-h2:border-zinc-200` |
| Tech Focused | `prose-slate`, `prose-h1:font-mono prose-h1:uppercase prose-h1:text-indigo-600` |
| Executive | `prose-stone font-serif`, `prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-center prose-h2:border-b-2` |
| Creative / Portfolio | `prose-pink`, `prose-h1:text-transparent prose-h1:bg-gradient-to-r prose-h1:from-pink-500 prose-h1:to-violet-500` |
| Photography / Visual | `prose-neutral`, `prose-h1:font-light prose-h1:uppercase prose-h1:tracking-[0.2em] prose-h1:text-center` |
| Academic / Research | `prose-zinc`, `prose-h2:bg-zinc-100 prose-h2:px-2 prose-h2:py-1` |

Accepts `customComponents` prop for overriding elements (used by `ResumeWorkspace` for annotation mark rendering).

---

## 14. Generic Workflow View (`WorkflowView`)

Used for all 10 standard workflows (all except `unified`, `resume`, `resume_generation`).

### Rendering Flow
1. **Intake Form** — `FormCard` for each field in `workflowsConfig[id].fields`
   - Field types: text, textarea, file upload (with PDF preview), url (with link badge), select (with "Other" custom fallback input)
2. **Processing** — terracotta `Loader2` spinner
3. **Results** — `MentorCard` with `react-markdown` output
   - Exception: `market` → renders `MarketCompensationViz`
   - Exception: `resume` → transitions to `ResumeWorkspace`
   - Exception: `resume_generation` → transitions to `ResumeGeneratorWorkspace`

### Helper Components
- `PageHeader` — Fraunces title + muted description
- `MentorCard` — `var(--card)` bg, `var(--border)` border, 24px border-radius
- `FormCard` — `var(--muted)` bg, `var(--border)` border, `var(--card)` input fields

---

## 15. Data Models

### Application (pipeline tracker)
```typescript
interface Application {
  id: string;
  company: string;
  role: string;
  location: string;
  appliedDate: string;
  status: "applied" | "interviewing" | "offer" | "rejected" | "pending";
}
```

### Annotation
```typescript
interface Annotation {
  textToHighlight: string;
  type: "strength" | "weakness";
  suggestion: string;
}
```

### Saved Analysis (localStorage key: `tc_saved_analyses`)
```typescript
interface SavedAnalysis {
  id: string;
  jobInput: string;
  yoe: string;
  level: string;
  marketData: string;       // JSON string of MarketCompData
  companyIntel: string;     // Markdown string
  resumeFit: string;        // Markdown string
  interviewStrategy: string;
  resumeData?: {
    name: string;
    base64Data: string;
    mimeType: string;
  };
}
```

### MarketCompData
```typescript
interface MarketCompData {
  summary: string;
  locations: LocationCompData[];
  sources: string[];
}

interface LocationCompData {
  locationName: string;
  salaryBands: { min: number; q1: number; median: number; q3: number; max: number };
  salaryHistogram?: { bucket: string; percentage: number }[];
  totalCompensation?: {
    baseMedian: number; bonusMedian: number; equityMedian: number;
    signOnMedian: number; totalEstimated: number; notes: string;
  };
  equity: string;
  yoyTrend: { year: string; compensation: number }[];
  costOfLiving: {
    housing: number; utilities: number; gas: number; groceries: number;
    dining?: number; transportation?: number; healthcare?: number;
    effectiveDisposableIncome: number;
  };
}
```

---

## 16. Server (`server.ts`)

```typescript
// POST /api/ai/generate
// Body: { systemInstruction: string, prompt: string, model?: string }
// Response: { text: string }
```

- Express server, port 4000
- CORS enabled for `http://localhost:3000`
- Default model: `gemini-1.5-flash`
- On error: `{ error: "The local Privacy Gateway is not running. Please run 'npx tsx server.ts' in your terminal." }`

---

## 17. Key UX Behaviors

| Behavior | Detail |
|---|---|
| **Auto-save indicator** | Resume editor debounces 1s → "Saving…" → "Saved" → clears after 2s |
| **Streaming AI** | All text streams token-by-token into UI via `onChunk` callback |
| **Custom "Other" fields** | Any select with `allowCustom: true` reveals freetext input when "Other" selected |
| **Suggested prompt chips** | Chat panel shows 3 chips when `messages.length < 2`; clicking submits as message |
| **Multi-page PDF preview** | PDFs show page counter + prev/next arrows |
| **Print styles** | `@media print` hides all sidebar/toolbar chrome; resume canvas fills page |
| **No dark mode** | System preference ignored — always Mentor mode warm cream |

---

## 18. Environment & Dev Setup

```bash
npm install
npm run dev        # Frontend on port 3000
npx tsx server.ts  # AI gateway on port 4000 (required for AI features)
npm run build      # Production build
```

Requires: Gemini CLI installed and authenticated locally.

---

## 19. Out of Scope (Current MVP)

- User authentication / accounts
- Database persistence (all data in localStorage)
- File storage (uploads are in-memory only)
- Push notifications
- Resume version history / diffs
- Mobile responsiveness (desktop-first)
- Sharing or exporting analyses
- Job board integrations (LinkedIn/Indeed/Greenhouse APIs)
- Application tracking automation

---

## 20. Seed Prompt for Claude Code

Use this to build the application from scratch:

```
Build a Career Coach AI web application per the PRD below.

[paste this entire PRD]

Build in this order:
1. Scaffold with Vite + React 19 + TypeScript, install all dependencies from section 3
2. Set up design system tokens in src/index.css (section 4) and @theme mapping
3. Add Fraunces Google Fonts link to index.html
4. Build Sidebar.tsx and App.tsx router (sections 5–6)
5. Build Dashboard.tsx (section 7)
6. Build server.ts AI gateway and geminiService.ts (sections 9, 16)
7. Build workflows.ts config with all 12 workflows (sections 10–11)
8. Build WorkflowView.tsx with FormCard/MentorCard/PageHeader helpers (section 14)
9. Build MarketCompensationViz.tsx with recharts (section 11.5)
10. Build ResumeRenderer.tsx (section 13)
11. Build ResumeWorkspace.tsx (section 12)
12. Build ResumeGenerationForm.tsx + ResumeGeneratorWorkspace.tsx (section 11.11)
13. Build UnifiedWorkspace.tsx (section 11.12)
14. Build GlobalChatPanel.tsx + FAB in App.tsx (section 8)

Color rule: always use CSS custom property vars (var(--primary), var(--card), etc.) for colors — never hardcode hex values except in the :root token definitions in index.css. Use .font-display (Fraunces) for all page headings and card titles. Use inline style={{ }} objects when Tailwind utilities can't reference CSS vars directly.
```
