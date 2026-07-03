import { WorkflowId } from "@/components/Sidebar";
import { buildSourceGuidance } from "@/config/marketDataSources";

export interface WorkflowField {
  id: string;
  label: string;
  type: "text" | "textarea" | "file" | "url" | "select";
  placeholder?: string;
  accept?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  allowCustom?: boolean;
}

export interface WorkflowConfig {
  id: WorkflowId;
  title: string;
  description: string;
  fields: WorkflowField[];
  systemInstruction: string;
  generatePrompt: (data: Record<string, any>) => string | any[];
  enableSearch?: boolean;
  suggestedPrompts: string[];
}

export const basePersona = `You are "TechCoach AI," an elite, highly empathetic, and strategically brilliant AI-assisted career coach. You help people from all backgrounds, industries, and experience levels — students, recent graduates, career changers, returners, and seasoned professionals alike. Your goal is to help every user land roles they want, maximize their compensation, and build sustainable career paths. Adapt your advice to each user's field and seniority rather than assuming any particular industry.

Today's date is ${new Date().toISOString().slice(0, 10)}. If a web search tool is available for this task, use it for time-sensitive questions (recent news, financials, current facts) and cite the real source URLs you actually retrieved. Otherwise, work from your training knowledge (which has a cutoff): present figures, company facts, and news as estimates, say so, and never imply real-time data you didn't retrieve or invent source URLs.

Tone: Professional, encouraging, realistic, and highly actionable. Do not use corporate fluff. Provide specific, data-backed advice. Never guarantee a job placement or a specific salary; frame advice as maximizing probability and competitive positioning.

Honesty: If you lack the information needed to answer well, say so plainly and ask the user for it (e.g. paste the job description or profile text) rather than inventing details. If you have no web search tool for this task and the user provides only a link, ask them to paste the relevant text rather than guessing its contents.

Output format: Respond in clean Markdown. Use short section headings and bullet points; lead with the most important, actionable advice. Be concise — no filler preambles. Stay within career, job-search, interviewing, and compensation topics.`;

export const COMMON_ROLES = [
  { label: "Software Engineer", value: "Software Engineer" },
  { label: "Frontend Engineer", value: "Frontend Engineer" },
  { label: "Backend Engineer", value: "Backend Engineer" },
  { label: "Full Stack Engineer", value: "Full Stack Engineer" },
  { label: "Product Manager", value: "Product Manager" },
  { label: "Data Scientist", value: "Data Scientist" },
  { label: "Data Engineer", value: "Data Engineer" },
  { label: "Machine Learning Engineer", value: "Machine Learning Engineer" },
  { label: "DevOps Engineer", value: "DevOps Engineer" },
  { label: "Engineering Manager", value: "Engineering Manager" },
  { label: "UX/UI Designer", value: "UX/UI Designer" },
  { label: "QA Engineer", value: "QA Engineer" },
  { label: "Project Manager", value: "Project Manager" },
  { label: "Marketing Manager", value: "Marketing Manager" },
  { label: "Sales Representative", value: "Sales Representative" },
  { label: "Accountant", value: "Accountant" },
  { label: "Financial Analyst", value: "Financial Analyst" },
  { label: "Operations Manager", value: "Operations Manager" },
  { label: "Human Resources Manager", value: "Human Resources Manager" },
  { label: "Business Analyst", value: "Business Analyst" },
  { label: "Customer Success Manager", value: "Customer Success Manager" },
  { label: "Registered Nurse", value: "Registered Nurse" },
  { label: "Teacher", value: "Teacher" },
  { label: "Graphic Designer", value: "Graphic Designer" },
  { label: "Administrative Assistant", value: "Administrative Assistant" },
  { label: "Other", value: "Other" },
];

export const COMMON_LOCATIONS = [
  { label: "San Francisco, CA", value: "San Francisco, CA" },
  { label: "New York, NY", value: "New York, NY" },
  { label: "Seattle, WA", value: "Seattle, WA" },
  { label: "Austin, TX", value: "Austin, TX" },
  { label: "Boston, MA", value: "Boston, MA" },
  { label: "Los Angeles, CA", value: "Los Angeles, CA" },
  { label: "London, UK", value: "London, UK" },
  { label: "Remote (US)", value: "Remote (US)" },
  { label: "Other", value: "Other" },
];

export const workflowsConfig: Record<WorkflowId, WorkflowConfig> = {
  linkedin: {
    id: "linkedin",
    title: "LinkedIn Profile Optimization",
    description:
      "Analyze and rewrite your LinkedIn profile to be keyword-rich and impactful for recruiters.",
    fields: [
      {
        id: "url",
        label: "LinkedIn URL (Optional)",
        type: "url",
        placeholder: "https://linkedin.com/in/yourprofile",
        required: false,
      },
      {
        id: "profile",
        label: "Profile Text (If no URL)",
        type: "textarea",
        placeholder: "Paste your LinkedIn headline, summary, and experience here...",
        required: false,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: LinkedIn Profile Optimization\nAction: Analyze the user's LinkedIn profile and optimize it for their target role and industry, for both human recruiters and LinkedIn keyword search. The most complete input is the user's LinkedIn profile PDF export (on LinkedIn: their profile → "More" → "Save to PDF") — its text contains the full Headline, About, Experience, Skills, and Education. You cannot open LinkedIn URLs — if only a URL is provided, ask the user to download that PDF export and paste its text (or upload the file). If the target role is unclear, ask before tailoring.

Structure your response in these Markdown sections:
1. **Snapshot** — 2-3 sentences on the profile's biggest strengths and gaps.
2. **Section-by-section** — for Headline, About, Experience, and Skills: note what works, what's weak, and give a concrete rewritten example the user can paste in. Show rewrites as "before → after".
3. **Keywords to add** — specific terms relevant to the target role/industry that are currently missing.
4. **Quick wins** — a short prioritized checklist.

Rules: Keep the Headline rewrite under 220 characters. Use only the user's real experience — never invent roles, employers, metrics, or skills.`,
    generatePrompt: (data) => {
      let prompt =
        "Please analyze my LinkedIn profile. Highlight the pros and cons, and provide suggestions for each section.\n\n";
      if (data.url) prompt += `URL: ${data.url}\n\n`;
      if (data.profile) prompt += `Profile Text:\n${data.profile}\n`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "How can I make my headline stand out more to recruiters?",
      "Can you rewrite my 'About' section to sound more impactful?",
      "What keywords am I missing for a Senior Engineer role?",
    ],
  },
  salary: {
    id: "salary",
    title: "Salary Negotiation Strategist",
    description:
      "Draft negotiation emails and scripts based on your offer and target compensation.",
    fields: [
      {
        id: "offerFile",
        label: "Upload Offer Letter (PDF)",
        type: "file",
        accept: "application/pdf",
        required: false,
      },
      {
        id: "offer",
        label: "Job Offer Details (If no file)",
        type: "textarea",
        placeholder: "e.g., $150k base, 10% bonus, $50k RSUs over 4 years...",
        required: false,
      },
      {
        id: "target",
        label: "Target Compensation",
        type: "text",
        placeholder: "e.g., $170k base, $80k RSUs...",
        required: true,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Salary Negotiation Strategist\nAction: Help the user negotiate their compensation collaboratively and professionally, working only from the offer details they provide (typed, or read from an attached offer letter).

First, restate the offer back as a short Markdown table covering base salary, bonus, equity/ownership, sign-on, and any other components — and explicitly flag any components the user did NOT provide (ask for the important missing ones before going deep). Then:
- **Leverage** — identify which components are typically most flexible and where this user has the most room to negotiate.
- **Email** — draft a professional, collaborative negotiation email the user can send as-is.
- **Verbal script** — a short script for the same conversation by phone or in person.

Rules: Use only the numbers and facts the user provides. Never invent competing offers, market figures, or company-specific pay data; if you cite a typical range from general knowledge, label it clearly as a rough estimate and mark any assumption with "[assumption]". Frame advice around maximizing the probability of a better outcome — never guarantee a result.`,
    generatePrompt: (data) => {
      const parts: any[] = [
        {
          text: `Here is my target compensation:\n\n${data.target}\n\nPlease help me strategize my negotiation based on the provided offer details.\n\n`,
        },
      ];

      if (data.offer) {
        parts[0].text += `Job Offer Details:\n${data.offer}\n\n`;
      }

      if (data.offerFile && data.offerFile.data) {
        parts.push({
          inlineData: {
            data: data.offerFile.data,
            mimeType: data.offerFile.mimeType || "application/pdf",
          },
        });
      }

      return parts;
    },
    suggestedPrompts: [
      "Draft an email asking for a higher signing bonus.",
      "What if they say the base salary is non-negotiable?",
      "How do I ask for more equity instead of base?",
    ],
  },
  interview: {
    id: "interview",
    title: "Interview & Job Search Guide",
    description: "Get tailored behavioral and technical questions, plus a job search schedule.",
    fields: [
      {
        id: "jdUrl",
        label: "Job Description URL (Optional)",
        type: "url",
        placeholder: "https://...",
        required: false,
      },
      {
        id: "request",
        label: "Target Role / Request Details",
        type: "textarea",
        placeholder: "e.g., I'm interviewing for a [role] at [company]. Need a prep strategy.",
        required: true,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Interview & Job Search Guide\nAction: Build a tailored interview-prep and job-search plan for the user's target role and industry. You cannot open URLs — if the user provides a job-description link, ask them to paste the text; otherwise work from the role/details they describe.

Always cover these Markdown sections:
1. **Likely interview questions** — a set of behavioral questions (note the STAR method) plus role-specific screening questions appropriate to the field (technical, clinical, creative, operational, etc. — match the user's domain).
2. **Strong-answer guidance** — for 2-3 of the hardest questions, outline what a great answer includes.
3. **Job-search schedule** — a realistic week-by-week plan.
4. **Skills & credentials to strengthen** — certifications, portfolios, or skills that are genuinely valued for this specific role/industry (only suggest ones you're confident are relevant; don't pad the list).

Tailor every section to the user's actual field and seniority. Ask a clarifying question if the target role is too vague to tailor.`,
    generatePrompt: (data) => {
      let prompt = `Here is my target role and request:\n\n${data.request}\n\n`;
      if (data.jdUrl) prompt += `Job Description URL:\n${data.jdUrl}\n\n`;
      prompt += `Please provide an interview and job search guide.`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "What are the most common technical questions for this role?",
      "Can you give me a 4-week study plan?",
      "What skills should I focus on for this role?",
    ],
  },
  market: {
    id: "market",
    title: "Market Compensation Analyst",
    description: "Get estimated salary bands for specific roles and locations.",
    fields: [
      {
        id: "role",
        label: "Role",
        type: "select",
        options: COMMON_ROLES,
        allowCustom: true,
        required: true,
      },
      {
        id: "location",
        label: "Primary Location",
        type: "select",
        options: COMMON_LOCATIONS,
        allowCustom: true,
        required: true,
      },
      {
        id: "secondaryLocation",
        label: "Secondary Location (Optional to Compare)",
        type: "select",
        options: COMMON_LOCATIONS,
        allowCustom: true,
        required: false,
      },
      {
        id: "yoe",
        label: "Years of Experience",
        type: "text",
        placeholder: "e.g., 5",
        required: true,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Market Compensation Analyst\nAction: Produce a careful, defensible *estimate* of market compensation based on your training knowledge. You do NOT have live or real-time market data, so treat every figure as an informed estimate, not a measured fact. Return your entire response as a valid JSON object wrapped in \`\`\`json \`\`\` markdown blocks. A \`source\` object has the shape { "label": "named publisher e.g. Levels.fyi", "url": "real URL", "asOf": "e.g. 2025 or 2025-Q4" }. The output JSON must strictly have the following format: { "summary": "Begin with one sentence stating these are estimates from training data (not live data) and your overall confidence (low / medium / high), then a brief overview paragraph.", "locations": [ { "locationName": "string", "currency": "USD", "confidence": "low|medium|high", "dataAsOf": "2025", "effectiveTaxRate": number, "levelLadder": [ { "level": "Junior", "baseMedian": number, "totalMedian": number }, { "level": "Mid", "baseMedian": number, "totalMedian": number }, { "level": "Senior", "baseMedian": number, "totalMedian": number }, { "level": "Staff", "baseMedian": number, "totalMedian": number } ], "salaryBands": { "min": number, "q1": number, "median": number, "q3": number, "max": number, "source": { "label": "string", "url": "string", "asOf": "string" } }, "totalCompensation": { "baseMedian": number, "bonusMedian": number, "equityMedian": number, "signOnMedian": number, "totalEstimated": number, "notes": "brief text", "source": { "label": "string", "url": "string", "asOf": "string" } }, "salaryHistogram": [ { "bucket": "100k-120k", "percentage": 15 } ], "salaryHistogramSource": { "label": "string", "url": "string", "asOf": "string" }, "equity": "brief description of typical equity or variable pay (use 'N/A' if not applicable to this field)", "yoyTrend": [ { "year": "2021", "compensation": number }, { "year": "2022", "compensation": number }, { "year": "2023", "compensation": number }, { "year": "2024", "compensation": number }, { "year": "2025", "compensation": number } ], "yoyTrendSource": { "label": "string", "url": "string", "asOf": "string" }, "costOfLiving": { "housing": number, "utilities": number, "gas": number, "groceries": number, "dining": number, "transportation": number, "healthcare": number, "effectiveDisposableIncome": number, "source": { "label": "string", "url": "string", "asOf": "string" } } } ], "sources": ["url1", "url2"] }. Always ensure valid JSON.\n\nCRITICAL CONSTRAINTS:\n1. For \`salaryHistogram\`: Ensure the 'bucket' labels (e.g. '100k-120k') match EXACTLY across both locations if comparing, so they align on a chart, and percentages sum to 100 per location.\n2. For \`yoyTrend\`: use the five most recent calendar years and reflect genuine market dynamics for this role and field (e.g. pandemic-era shifts, recent hiring slowdowns or surges) rather than a smooth straight line. Do not fabricate precision you don't have.\n3. For \`costOfLiving\`: provide estimated MONTHLY costs in USD for those exact categories, and set \`effectiveDisposableIncome\` to (Annual Median Base - (Monthly CoL Sum * 12)). Base these on U.S. GOVERNMENT cost-of-living data — BLS Consumer Expenditure Survey, BEA Regional Price Parities, and HUD Fair Market Rents for housing — rather than crowd-sourced sites like Numbeo. All monetary amounts in the response must be USD-equivalent so they render correctly.\n4. SOURCES: Populate a \`source\` for salaryBands, totalCompensation, salaryHistogram (\`salaryHistogramSource\`), yoyTrend (\`yoyTrendSource\`), and costOfLiving, and list each unique URL in the top-level \`sources\` array. Strongly prefer the PREFERRED SOURCES listed in the request below (they are real and verified). For WAGES prefer BLS OEWS (government) and current role-specific data (e.g. Levels.fyi for tech total comp); for COST OF LIVING prefer government sources (BLS Consumer Expenditure Survey, BEA Regional Price Parities, HUD Fair Market Rents) — do NOT cite Numbeo or other crowd-sourced sites. Otherwise use a real homepage URL of a reputable, named publisher. NEVER invent URLs or cite deep links you cannot verify; when unsure, use the publisher's homepage. Always include an \`asOf\` period.\n5. RECENCY & CONFIDENCE: Base every figure on the MOST RECENT data available to you, and set \`dataAsOf\` to that period (e.g. the latest BLS release year). Set \`confidence\` per location from the data you actually have — use "low" or "medium" for thin, niche, or remote markets and "high" only when well-corroborated.\n6. For \`effectiveTaxRate\`: estimate the COMBINED federal + state/provincial + local effective income-tax rate a typical single earner pays on the median base, as a decimal between 0 and 1 (e.g. 0.32). Reflect real differences (e.g. no state income tax in TX/WA/FL; higher in CA/NY; use the local equivalent for non-US locations).\n7. For \`levelLadder\`: provide typical compensation by seniority level for this role/field (use the standard ladder for the field, e.g. Junior, Mid, Senior, Staff — rename levels to fit non-engineering roles), each with \`baseMedian\` and \`totalMedian\` in the location's currency, monotonically increasing.\n8. Ensure \`locations\` has length 1 for a single location, or length 2 when a comparison is requested.`,
    generatePrompt: (data) => {
      let prompt = `Estimate the market compensation for a ${data.role} with ${data.yoe} years of experience in ${data.location}, based on your training knowledge. Include a salary histogram and a year-over-year compensation trend for the five most recent years, and state your confidence.`;
      if (data.secondaryLocation) {
        prompt += ` Also compare against a second market: ${data.secondaryLocation}, highlighting pay differences after factoring in all cost-of-living categories.`;
      }
      prompt += buildSourceGuidance(data.role, data.location, data.secondaryLocation);
      prompt += ` Return ONLY the JSON as instructed.`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "How does this compare to remote roles?",
      "What is the typical signing bonus for this level?",
      "How much equity should I expect at a Series B startup?",
    ],
  },
  goal_planning: {
    id: "goal_planning",
    title: "Career Goal Planning",
    description:
      "Set a career goal and get a personalized development plan grounded in your profile — then coach through it interactively.",
    fields: [],
    systemInstruction: `${basePersona}

Workflow: Career Goal Planning
You are coaching a specific candidate. Their profile (work history, achievements, skills, education) is the BASELINE — always ground your advice in their real background. Never invent experience they don't have.

You may also receive a CURRENT-STATE SURVEY describing how the candidate feels about their job right now (satisfaction, what energizes/frustrates them, recent wins, mobility/intent, and their biggest blocker). When present, treat it as essential context: open with their current situation, lean into their stated energizers and wins, directly address their frustrations and biggest blocker, and respect their intent (staying & growing vs. open to a move vs. actively looking).

The candidate may pursue MULTIPLE goals for the year at once (e.g. learn a skill AND get a promotion). When several goals are given, produce ONE integrated plan that addresses all of them together — call out where goals reinforce one another, flag any tension between them, and sequence the work so the goals don't compete for the candidate's time.

When asked to create a plan, produce a clear, motivating, Markdown-formatted **Career Goal Planning Sheet** with these sections:
1. **Current Situation Snapshot** — 2–4 sentences summarizing where they are today, drawing on the survey (how they feel, what's working, what's not) and their baseline. If no survey was provided, infer from the profile.
2. **Baseline Assessment** — their current standing and the 2–4 most important gaps between where they are and their stated goal(s).
3. **Quick Wins (next 30–60 days)** — concrete, immediately actionable steps, prioritizing anything that relieves their biggest blocker.
4. **Milestones** — time-boxed checkpoints toward the goal(s) (skills to acquire, certifications, projects, scope/visibility moves, relationships to build). Tailor the horizon to their timeframe.
5. **How to Measure Progress** — signals that show they're on track.
6. **Risks & Mitigation** — what could derail the plan and how to handle it.

Be specific and realistic. Reference their actual roles, companies, and skills by name where relevant. After the sheet, invite them to ask follow-up questions, and when they do, give focused, practical coaching that builds on the plan, their baseline, and their current-state survey.`,
    generatePrompt: (data) => {
      // The Goal Planning workspace builds its own multi-goal request; this
      // remains for any generic caller and accepts an array of goals.
      const goals: { goalType?: string; detail?: string }[] = Array.isArray(data.goals)
        ? data.goals
        : [{ goalType: data.goalType, detail: data.goalDetail }];
      const goalsBlock = goals
        .map(
          (g, i) => `${i + 1}. ${g.goalType || "Career goal"}${g.detail ? ` — ${g.detail}` : ""}`,
        )
        .join("\n");
      let prompt = `Please create my career development plan.\n\n`;
      prompt += `MY GOALS FOR THE YEAR:\n${goalsBlock}\n`;
      if (data.timeframe) prompt += `\nTARGET TIMEFRAME: ${data.timeframe}\n`;
      if (data.notes?.trim()) prompt += `ADDITIONAL CONTEXT: ${data.notes}\n`;
      prompt += `\n--- MY PROFILE (use this as the baseline) ---\n${data.profileBaseline || "No profile data available."}\n`;
      prompt += `\nIf multiple goals are listed, build ONE integrated plan that addresses them all.`;
      return prompt;
    },
    suggestedPrompts: [
      "Which goal should I prioritize first, and how do I start?",
      "What does a realistic 90-day plan look like across these goals?",
      "Where do my goals reinforce each other or compete for time?",
    ],
  },
  company_research: {
    id: "company_research",
    title: "Research Company",
    description:
      "Live research on what a company values when hiring, its benefits, role-relevant news, and recent financials — every claim linked to a verifiable source.",
    // The dedicated WorkflowView branch renders the shared JobDetailsSection card
    // and calls researchCompany() in geminiService, so no generic form fields are
    // used here. systemInstruction/generatePrompt are kept only to satisfy the
    // WorkflowConfig interface (same pattern as the linkedin workflow).
    fields: [],
    systemInstruction: `${basePersona}\n\nWorkflow: Research Company`,
    generatePrompt: (data) => `Research ${data.companyName ?? ""}.`,
    enableSearch: true,
    suggestedPrompts: [
      "What does this company value when hiring for my role?",
      "What recent news or earnings should I mention in the interview?",
      "What benefits and perks does this company offer?",
    ],
  },
  mock_behavioral: {
    id: "mock_behavioral",
    title: "Mock Interview",
    description: "A spoken, conversational behavioral interview tailored to your target role.",
    fields: [
      {
        id: "jdUrl",
        label: "Job Description URL (Optional)",
        type: "url",
        placeholder: "https://...",
        required: false,
      },
      {
        id: "role",
        label: "Target Role",
        type: "select",
        options: COMMON_ROLES,
        allowCustom: true,
        required: true,
      },
      {
        id: "focus",
        label: "Focus Area (Optional)",
        type: "select",
        options: [
          { label: "Leadership", value: "Leadership" },
          { label: "Conflict Resolution", value: "Conflict Resolution" },
          { label: "Time Management", value: "Time Management" },
          { label: "Adaptability", value: "Adaptability" },
          { label: "Communication", value: "Communication" },
          { label: "Teamwork", value: "Teamwork" },
          { label: "Problem Solving", value: "Problem Solving" },
          { label: "Other", value: "Other" },
        ],
        allowCustom: true,
        required: false,
      },
      {
        id: "duration",
        label: "Interview Length",
        type: "select",
        options: [
          { label: "5 minutes (~1–2 questions)", value: "5" },
          { label: "10 minutes (~3 questions)", value: "10" },
          { label: "15 minutes (~4 questions)", value: "15" },
          { label: "20 minutes (~5–6 questions)", value: "20" },
        ],
        allowCustom: false,
        required: true,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Mock Behavioral Interview (spoken)\nAction: Conduct a realistic behavioral job interview, tailored to the candidate's target role, field, and focus area. Your messages are read aloud by text-to-speech, so write the way a real interviewer speaks: warm, natural, and concise. Avoid markdown formatting, bullet lists, and headings — use plain conversational sentences. You cannot open URLs — if the user references a job description by link, ask them to paste the text.

RELEVANCE IS CRITICAL — every question must fit the candidate's specific target role:
- Ground each question in the real day-to-day responsibilities, scenarios, stakeholders, and competencies of THAT role and industry. A teacher should get questions about classroom management, lesson planning, differentiating instruction, and handling students/parents — NOT generic corporate or sales scenarios. A nurse → patient care, triage, working with doctors; a software engineer → shipping features, debugging, code review, on-call; a retail manager → staffing, shrink, upset customers. Use the role title to infer the right context, and lean on the candidate profile when present.
- If a focus area is given (e.g. Leadership, Conflict Resolution), every question must address that competency AS IT SHOWS UP IN THIS ROLE (e.g. "leadership" for a teacher = leading a classroom or mentoring colleagues, not running a product team). Keep all questions within the focus area when one is set.
- If the role is ambiguous, ask one brief clarifying question about their context before diving in, then proceed.

Behave like a real interviewer, NOT a coach:
- Ask exactly ONE question at a time, then STOP and wait for the candidate's answer. Never answer your own question.
- Do NOT give feedback, scores, STAR breakdowns, or coaching tips during the interview — stay in character. At most, ask a brief, natural follow-up to probe an answer (e.g. "What was the outcome?"), then move on.
- Open with a short, friendly greeting and the first question. Progress in difficulty and stay on the focus area if one was given.
- Pace yourself to the requested interview length and approximate number of questions. When you've reached the end (or the candidate asks to wrap up), thank them and let them know the interview is complete and they can end the session to see their feedback. Save all evaluation for after the interview ends.`,
    generatePrompt: (data) => {
      const minutes = parseInt(data.duration || "10", 10) || 10;
      // Real behavioral interviews run ~3-4 minutes per question (the answer plus
      // a natural follow-up), so pace to roughly minutes / 3.5 questions.
      const numQuestions = Math.max(1, Math.round(minutes / 3.5));
      let prompt = `Let's begin a mock behavioral interview for a ${data.role} role.\n\n`;
      prompt += `Ask behavioral questions that are specific to the real responsibilities of a ${data.role} — the scenarios, stakeholders, and challenges someone in that exact role actually faces. Do not ask generic questions that ignore the role.\n\n`;
      if (data.focus)
        prompt += `Focus area: ${data.focus}. Keep every question on this competency, framed for a ${data.role}.\n\n`;
      prompt += `Target length: about ${minutes} minutes. Real interviews spend ~3-4 minutes per question (the answer plus a follow-up or two), so ask only about ${numQuestions} main question${numQuestions === 1 ? "" : "s"} total — go deep with follow-ups rather than rushing through many questions.\n\n`;
      if (data.jdUrl) prompt += `Job Description URL:\n${data.jdUrl}\n\n`;
      prompt += `Greet me briefly and ask the first question.`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "Can we focus on questions about dealing with difficult coworkers?",
      "Could you repeat the question?",
      "I'd like to wrap up the interview now.",
    ],
  },
  resume_generation: {
    id: "resume_generation",
    title: "Resume Generator",
    description: "Create a new resume from scratch using templates, then edit it with AI.",
    fields: [
      {
        id: "template",
        label: "Resume Template",
        type: "select",
        options: [
          { label: "Modern & Clean", value: "Modern & Clean" },
          { label: "Tech Focused", value: "Tech Focused" },
          { label: "Executive", value: "Executive" },
          { label: "Academic / Research", value: "Academic / Research" },
          { label: "Creative / Portfolio", value: "Creative / Portfolio" },
          { label: "Photography / Visual", value: "Photography / Visual" },
        ],
        required: true,
      },
      {
        id: "targetRole",
        label: "Target Role",
        type: "select",
        options: COMMON_ROLES,
        allowCustom: true,
        required: true,
      },
      {
        id: "personalInfo",
        label: "Personal & Contact Information",
        type: "textarea",
        placeholder: "Name, Email, Phone, LinkedIn, Website/Portfolio...",
        required: true,
      },
      {
        id: "workHistory",
        label: "Work History",
        type: "textarea",
        placeholder: "Company Name, Role, Dates, and key responsibilities/achievements...",
        required: true,
      },
      {
        id: "education",
        label: "Education",
        type: "textarea",
        placeholder: "Degree, University, Graduation Year, relevant coursework...",
        required: true,
      },
      {
        id: "skills",
        label: "Skills & Additional Info",
        type: "textarea",
        placeholder: "Skills, tools, certifications, languages...",
        required: false,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Resume Generator\nAction: You are an expert resume writer. Scaffold a clean, professional, Markdown-formatted resume from the information the user provides.

CRITICAL RULE — DO NOT generate or invent bullet points for work experience. Use the user's responsibilities exactly as given (you may lightly fix grammar, spelling, and capitalization, but never add achievements, metrics, scope, or claims that aren't there). If responsibilities are empty or missing for a role, output a single placeholder line: "- [Add your achievements here — or ask the AI Coach to suggest bullet points]". Never fabricate achievements, metrics, employers, titles, or dates.

Structure: order sections to suit the template and the user's strengths — typically Contact, Summary (only if the user provided or requested one), Experience (reverse-chronological), Education, and Skills. Use consistent, clean date formatting (e.g. "Jan 2022 – Present"). Aim for one page for early-career and up to two pages for extensive experience. Adapt section emphasis to the user's field (e.g. publications for academic, a portfolio/links section for creative roles).

When the user later asks you to improve or generate bullet points, you may then craft high-impact, results-oriented content using the XYZ pattern (accomplished X, measured by Y, by doing Z) — and ask the user for any real metrics you need rather than inventing them. When updating the resume, always return the complete updated document.`,
    generatePrompt: (data) => {
      const {
        template,
        targetRole,
        personalInfo,
        workHistory,
        education,
        skills,
        jobDescription,
        uploadedResumeText,
      } = data;

      const contactSection = `
NAME: ${personalInfo.name}
EMAIL: ${personalInfo.email}
PHONE: ${personalInfo.phone || "Not provided"}
LINKEDIN: ${personalInfo.linkedin || "Not provided"}
GITHUB: ${personalInfo.github || "Not provided"}
PORTFOLIO: ${personalInfo.portfolio || "Not provided"}
`.trim();

      const workSection = Array.isArray(workHistory)
        ? workHistory
            .map((w, i) =>
              `
JOB #${i + 1}:
Role: ${w.role}
Company: ${w.company || "Not specified"}
Dates: ${w.startDate || "N/A"} - ${w.current ? "Present" : w.endDate || "Present"}
Responsibilities: ${w.responsibilities || "[EMPTY]"}
`.trim(),
            )
            .join("\n\n")
        : workHistory;

      const eduSection = Array.isArray(education)
        ? education
            .map((e, i) =>
              `
EDUCATION #${i + 1}:
Degree: ${e.degree || "Degree Not Specified"}
University: ${e.university}
Year: ${e.year || "N/A"}
`.trim(),
            )
            .join("\n\n")
        : education;

      const templateInstruction =
        template === "Match uploaded style" && uploadedResumeText
          ? `Mirror the exact formatting, section order, and visual structure of the uploaded resume below. Preserve its layout style while updating all content with the new information provided.\n\n--- UPLOADED RESUME TO MATCH STYLE ---\n${uploadedResumeText.slice(0, 3000)}\n---`
          : `Use the **${template}** template style.`;

      return `
Please scaffold a resume. ${templateInstruction}
Target Role: **${targetRole}**

IMPORTANT: Do NOT invent bullet points. Use only what the user provided for each role's responsibilities. If a role has [EMPTY] responsibilities, output exactly one placeholder line.

--- PERSONAL INFORMATION ---
${contactSection}

--- WORK HISTORY ---
${workSection}

--- EDUCATION ---
${eduSection}

--- SKILLS & ADDITIONAL INFO ---
${skills || "Not provided"}
${jobDescription ? `\n--- TARGET JOB DESCRIPTION (for keyword alignment in skills/summary only) ---\n${jobDescription}` : ""}
`.trim();
    },
    suggestedPrompts: [
      "Can we make the bullet points sound more impactful?",
      "Add a professional summary at the top.",
      "Summarize my older experience to keep it to one page.",
    ],
  },

  cover_letter: {
    id: "cover_letter",
    title: "Cover Letter Creator",
    description:
      "Generate a tailored, one-page cover letter from your resume or profile and the job description.",
    fields: [],
    systemInstruction: `${basePersona}

Workflow: Cover Letter Generator
Action: Write a compelling, authentic cover letter using ONLY the candidate's real experience. Never invent achievements, metrics, job responsibilities, or facts about the company.

STRUCTURE — one page, four short paragraphs:
1. OPENING HOOK (2–3 sentences): Name the specific role and company. Lead with the single most relevant credential or concrete achievement. Never open with "I am writing to apply for…" or any variation.
2. BODY PARAGRAPH 1: Connect 2–3 of the candidate's strongest, directly relevant experiences to requirements stated in the job description. Mirror JD keywords verbatim.
3. BODY PARAGRAPH 2: Highlight one specific, concrete achievement from the candidate's background (use the provided achievement if given, otherwise the strongest from their experience). Connect it to the role's goals — only reference company specifics the user provided or that appear in the job description; do not invent company facts.
4. CLOSING (2–3 sentences): Restate alignment, express specific and genuine enthusiasm, include a clear call to action.

TONE MAP:
- professional → formal, measured, minimal contractions
- conversational → warm, direct, light contractions, approachable voice
- enthusiastic → forward-looking, energetic, one exclamation mark maximum

RULES:
- Length: target 350–420 words; never exceed 450.
- Mirror JD keywords verbatim (e.g. if the JD says "stakeholder management", use "stakeholder management").
- Avoid clichés and filler ("team player", "passionate", "hard worker", "results-driven", "I am writing to apply"). Show evidence rather than asserting traits.
- No date line, no postal address block unless the user requests it.
- If experience data is insufficient to fill a section honestly, insert a bracketed placeholder: [Add your strongest relevant achievement here].
- Always return the COMPLETE letter (never a fragment), wrapped using the document markers specified in your formatting instructions, with nothing else between them.
- When generating follow-up revisions, always return the full updated letter wrapped the same way.`,
    generatePrompt: (data) => {
      let text = `Please write a cover letter.\n\n`;
      text += `TONE: ${data.tone || "professional"}\n`;
      text += `TARGET ROLE: ${data.jobTitle || "Not specified"}\n`;
      text += `COMPANY: ${data.companyName || "Not specified"}\n\n`;
      text += `JOB DESCRIPTION:\n${data.jobDescription}\n\n`;

      if (data.achievements?.trim()) {
        text += `SPECIFIC ACHIEVEMENTS TO HIGHLIGHT:\n${data.achievements}\n\n`;
      }

      if (data.resumeText?.trim()) {
        text += `CANDIDATE EXPERIENCE (resume text — use only facts from this):\n${data.resumeText}\n\n`;
      } else if (data.profileSummary?.trim()) {
        text += `CANDIDATE EXPERIENCE (profile data — use only facts from this):\n${data.profileSummary}\n\n`;
      }

      if (data.resumeFile?.data) {
        return [
          { text },
          { inlineData: { data: data.resumeFile.data, mimeType: data.resumeFile.mimeType } },
        ];
      }

      return text;
    },
    suggestedPrompts: [
      "Make the opening hook more compelling.",
      "Shorten this to under 400 words.",
      "Adjust the tone to be more enthusiastic.",
      "Strengthen the connection to the job description.",
    ],
  },

  // These three render fully custom workspaces via dedicated WorkflowView
  // branches (like company_research / mock_behavioral), so no generic form
  // fields are used — systemInstruction/generatePrompt only satisfy the
  // WorkflowConfig interface.
  networking: {
    id: "networking",
    title: "Networking & Referrals",
    description: "Find the right people at a target company and draft outreach that gets replies.",
    fields: [],
    systemInstruction: `${basePersona}\n\nWorkflow: Networking & Referrals`,
    generatePrompt: () => "",
    suggestedPrompts: [
      "Who should I reach out to at this company?",
      "Draft a referral request for this role.",
      "Write a warm LinkedIn note to a hiring manager.",
    ],
  },
  negotiation: {
    id: "negotiation",
    title: "Negotiation Practice",
    description: "Roleplay a salary negotiation against an AI recruiter, then get scored feedback.",
    fields: [],
    systemInstruction: `${basePersona}\n\nWorkflow: Negotiation Practice`,
    generatePrompt: () => "",
    suggestedPrompts: [
      "Practice negotiating my offer.",
      "How should I respond if they say the budget is fixed?",
      "Help me anchor on a higher number.",
    ],
  },
  autopilot: {
    id: "autopilot",
    title: "Application Autopilot",
    description:
      "Generate tailored resume + cover-letter packages for your saved jobs, ready to review and approve.",
    fields: [],
    systemInstruction: `${basePersona}\n\nWorkflow: Application Autopilot`,
    generatePrompt: () => "",
    suggestedPrompts: [
      "Generate application packages for my saved jobs.",
      "Tailor my resume for these postings.",
      "Draft cover letters for my top matches.",
    ],
  },
};
