import { WorkflowId } from "@/components/Sidebar";

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

const basePersona = `You are "TechCoach AI," an elite, highly empathetic, and strategically brilliant career coach specializing in the technology sector (software engineering, product management, data science, and IT). Your goal is to help users land their ideal tech jobs, maximize their compensation, and build sustainable career paths.

Tone: Professional, encouraging, realistic, and highly actionable. Do not use corporate fluff. Provide specific, data-backed advice. Never guarantee a job placement or a specific salary; frame advice as maximizing probability and competitive positioning.`;

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
    description: "Analyze and rewrite your LinkedIn profile to be keyword-rich and impactful for tech recruiters.",
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
    systemInstruction: `${basePersona}\n\nWorkflow: LinkedIn Profile Optimization\nAction: Analyze the provided LinkedIn profile (via URL or text). First, highlight the pros and cons of the current profile. Then, provide specific suggestions for each section (Headline, About, Experience, Skills) to make it keyword-rich for tech recruiters.`,
    generatePrompt: (data) => {
      let prompt = "Please analyze my LinkedIn profile. Highlight the pros and cons, and provide suggestions for each section.\n\n";
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
  resume: {
    id: "resume",
    title: "Resume Analysis",
    description: "Upload your resume for a critical evaluation of its technical depth, impact metrics, and keyword alignment.",
    fields: [
      {
        id: "resumeFile",
        label: "Upload Resume (PDF)",
        type: "file",
        accept: "application/pdf",
        required: false,
      },
      {
        id: "resumeText",
        label: "Or Paste Resume Text",
        type: "textarea",
        placeholder: "Paste your resume text here...",
        required: false,
      },
      {
        id: "jdUrl",
        label: "Job Description URL (Optional)",
        type: "url",
        placeholder: "https://...",
        required: false,
      },
      {
        id: "jd",
        label: "Target Job Description (If no URL)",
        type: "textarea",
        placeholder: "Paste the job description here...",
        required: false,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Resume Analysis\nAction: Conduct a high-level audit of the provided resume. Your primary objective is to evaluate how effectively the candidate communicates their technical expertise and business impact.\n\nInstructions for Analysis:\n1. Audit every bullet point for the 'XYZ Formula' (Action + Metric + Result).\n2. Cross-reference the skills listed against the provided Job Description to identify critical gaps.\n3. Highlight specific sections that are either exceptionally strong or require immediate revision.\n4. Provide actionable, technical feedback for each highlighted section.\n5. Return an improved version of the text as a Markdown document, with annotations mapped to substrings in that improved version.`,
    generatePrompt: (data) => {
      const parts: any[] = [{ text: `I am submitting my resume for a comprehensive technical analysis. Please review the content for impact metrics, clarity, and relevance to the target role. Highlight strengths to maintain and specific areas that need revision.\n\n` }];
      
      if (data.jdUrl) {
        parts[0].text += `Target Job Description URL:\n${data.jdUrl}\n\n`;
      }
      if (data.jd) {
        parts[0].text += `Target Job Description Text:\n${data.jd}\n\n`;
      }
      
      if (data.resumeText) {
        parts.push({ text: `\n\nHere is my resume text:\n${data.resumeText}` });
      }
      
      if (data.resumeFile && data.resumeFile.data) {
        parts.push({
          inlineData: {
            data: data.resumeFile.data,
            mimeType: data.resumeFile.mimeType || "application/pdf"
          }
        });
      }
      
      return parts;
    },
    enableSearch: true,
    suggestedPrompts: [
      "How can I better quantify my contributions in my most recent role?",
      "Which keywords from the job description am I failing to address?",
      "Is the technical stack mentioned appropriate for this seniority level?",
    ],
  },
  salary: {
    id: "salary",
    title: "Salary Negotiation Strategist",
    description: "Draft negotiation emails and scripts based on your offer and target compensation.",
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
    systemInstruction: `${basePersona}\n\nWorkflow: Salary Negotiation Strategist\nAction: Draft professional, collaborative negotiation emails. Provide a script for phone conversations. Break down the total compensation (TC) to identify the most flexible areas for negotiation (e.g., signing bonus vs. base). If an offer letter is provided, scrape it for the offer details.`,
    generatePrompt: (data) => {
      const parts: any[] = [{ text: `Here is my target compensation:\n\n${data.target}\n\nPlease help me strategize my negotiation based on the provided offer details.\n\n` }];
      
      if (data.offer) {
        parts[0].text += `Job Offer Details:\n${data.offer}\n\n`;
      }
      
      if (data.offerFile && data.offerFile.data) {
        parts.push({
          inlineData: {
            data: data.offerFile.data,
            mimeType: data.offerFile.mimeType || "application/pdf"
          }
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
        placeholder: "e.g., I'm interviewing for a Senior Backend role at Stripe. Need prep strategy.",
        required: true,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Interview & Job Search Guide\nAction: Generate tailored behavioral (STAR method) questions and technical screening questions. Provide a week-by-week job search schedule or suggest highly valued certifications (e.g., AWS, CKA) based on their target role. If a JD URL is provided, scrape it for context.`,
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
      "What system design topics should I focus on?",
    ],
  },
  market: {
    id: "market",
    title: "Market Compensation Analyst",
    description: "Get estimated salary bands for specific tech roles and locations.",
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
    systemInstruction: `${basePersona}\n\nWorkflow: Market Compensation Analyst\nAction: Use your knowledge to estimate market compensation data. Return your entire response as a valid JSON object wrapped in \`\`\`json \`\`\` markdown blocks. The output JSON must strictly have the following format: { "summary": "brief overview paragraph", "locations": [ { "locationName": "string", "salaryBands": { "min": number, "q1": number, "median": number, "q3": number, "max": number }, "totalCompensation": { "baseMedian": number, "bonusMedian": number, "equityMedian": number, "signOnMedian": number, "totalEstimated": number, "notes": "brief text" }, "salaryHistogram": [ { "bucket": "100k-120k", "percentage": 15 } ], "equity": "brief description of typical equity", "yoyTrend": [ { "year": "2020", "compensation": number }, { "year": "2021", "compensation": number }, { "year": "2022", "compensation": number }, { "year": "2023", "compensation": number }, { "year": "2024", "compensation": number } ], "costOfLiving": { "housing": number, "utilities": number, "gas": number, "groceries": number, "dining": number, "transportation": number, "healthcare": number, "effectiveDisposableIncome": number } } ], "sources": ["url1", "url2"] }. Always ensure valid JSON.\n\nCRITICAL CONSTRAINTS:\n1. For \`salaryHistogram\`: Ensure the 'bucket' labels (e.g. '100k-120k') match EXACTLY across both locations if comparing, so they align on a chart, and percentages sum to 100 per location.\n2. For \`yoyTrend\`: Do NOT hallucinate standard linear trends. Use REAL, accurate historical compensation trends (e.g., tech boom in 2021/2022, plateau/drop in 2023/2024). \n3. For \`costOfLiving\`: provide estimated MONTHLY costs in USD for those exact categories, and set \`effectiveDisposableIncome\` to (Annual Median Base - (Monthly CoL Sum * 12)). Ensure \`locations\` array has length 1 if only one location, or length 2 if a comparison is requested.`,
    generatePrompt: (data) => {
      let prompt = `What is the real, data-driven market compensation for a ${data.role} with ${data.yoe} years of experience in ${data.location}? Provide an accurate salary histogram and genuine YoY compensation history that reflects the actual market dynamics over the past 5 years.`;
      if (data.secondaryLocation) {
        prompt += ` Please also provide a comparison with a second market: ${data.secondaryLocation}, highlighting actual pay differences after factoring in all cost of living categories.`;
      }
      prompt += ` Please return ONLY the JSON as instructed!`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "How does this compare to remote roles?",
      "What is the typical signing bonus for this level?",
      "How much equity should I expect at a Series B startup?",
    ],
  },
  career: {
    id: "career",
    title: "Career Path Cartographer",
    description: "Outline a step-by-step roadmap to reach your ultimate career goal.",
    fields: [
      {
        id: "current",
        label: "Current Role",
        type: "select",
        options: COMMON_ROLES,
        allowCustom: true,
        required: true,
      },
      {
        id: "goal",
        label: "Ultimate Career Goal",
        type: "select",
        options: COMMON_ROLES,
        allowCustom: true,
        required: true,
      },
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Career Path Cartographer\nAction: Outline a step-by-step 3, 5, and 10-year roadmap. Include necessary title progressions, skills to acquire, and the types of companies to target at each stage.`,
    generatePrompt: (data) => `My current role is: ${data.current}\nMy ultimate career goal is: ${data.goal}\n\nPlease map out my career path.`,
    suggestedPrompts: [
      "What certifications would accelerate this path?",
      "Should I transition to management or stay an IC?",
      "What are the biggest risks to this career plan?",
    ],
  },
  company_research: {
    id: "company_research",
    title: "Company Research & Interview Questions",
    description: "Research a company, get ratings/reviews (Glassdoor, Blind), and generate questions to ask.",
    fields: [
      {
        id: "jdUrl",
        label: "Job Description URL (Optional)",
        type: "url",
        placeholder: "https://...",
        required: false,
      },
      {
        id: "company",
        label: "Company Name",
        type: "text",
        placeholder: "e.g., Google, Stripe, Airbnb",
        required: true,
      },
      {
        id: "role",
        label: "Target Role",
        type: "select",
        options: COMMON_ROLES,
        allowCustom: true,
        required: true,
      }
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Company Research\nAction: Use Google Search to find recent news, market position, and company ratings/reviews from Glassdoor and Blind. Summarize the company's culture and market standing. Then, generate a list of insightful questions to ask the recruiter and interviewer for the specified role. If a JD URL is provided, scrape it for context.`,
    generatePrompt: (data) => {
      let prompt = `Please research ${data.company} for a ${data.role} role.\n\n`;
      if (data.jdUrl) prompt += `Job Description URL:\n${data.jdUrl}\n\n`;
      prompt += `Include ratings/reviews from Glassdoor and Blind, and suggest questions to ask.`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "What are the biggest red flags from employee reviews?",
      "What recent news should I mention in the interview?",
      "Give me 3 tough questions to ask the hiring manager.",
    ],
  },
  mock_behavioral: {
    id: "mock_behavioral",
    title: "Mock Behavioral Interview",
    description: "Practice behavioral questions with direct guidance and feedback.",
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
      }
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Mock Behavioral Interview\nAction: Act as an interviewer. Ask one behavioral question at a time based on the role and focus area. Wait for the user's response. After they respond, provide constructive feedback using the STAR method, then ask the next question. Provide direct guidance on how to improve. If a JD URL is provided, scrape it for context to ask more tailored questions.`,
    generatePrompt: (data) => {
      let prompt = `Let's start a mock behavioral interview for a ${data.role} role. ${data.focus ? `Focus on: ${data.focus}.` : ''}\n\n`;
      if (data.jdUrl) prompt += `Job Description URL:\n${data.jdUrl}\n\n`;
      prompt += `Please ask the first question.`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "Can we focus on questions about dealing with difficult coworkers?",
      "I don't have a good example for that, can you give me a hint?",
      "How would you rate my last answer out of 10?",
    ],
  },
  mock_case_study: {
    id: "mock_case_study",
    title: "Mock Case Study & Design Test",
    description: "Practice product case studies and design tests with step-by-step guidance.",
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
        id: "topic",
        label: "Case Study Topic (Optional)",
        type: "select",
        options: [
          { label: "Product Strategy", value: "Product Strategy" },
          { label: "Product Design", value: "Product Design" },
          { label: "Metrics & Analytics", value: "Metrics & Analytics" },
          { label: "Go-to-Market", value: "Go-to-Market" },
          { label: "Growth & Acquisition", value: "Growth & Acquisition" },
          { label: "Other", value: "Other" },
        ],
        allowCustom: true,
        required: false,
      }
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Mock Case Study\nAction: Act as an interviewer conducting a case study or design test. Present a prompt, guide the user through clarifying questions, framework structuring, and solution design. Provide feedback at each step. If a JD URL is provided, scrape it to tailor the case study.`,
    generatePrompt: (data) => {
      let prompt = `Let's start a mock case study for a ${data.role} role. ${data.topic ? `Topic: ${data.topic}.` : 'Please provide a random prompt.'}\n\n`;
      if (data.jdUrl) prompt += `Job Description URL:\n${data.jdUrl}\n\n`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "What framework should I use to structure my answer?",
      "Can you act as the user so I can ask clarifying questions?",
      "What edge cases am I missing?",
    ],
  },
  mock_tech: {
    id: "mock_tech",
    title: "Mock Tech Interview",
    description: "Practice system design, AI engineering, or coding interviews.",
    fields: [
      {
        id: "jdUrl",
        label: "Job Description URL (Optional)",
        type: "url",
        placeholder: "https://...",
        required: false,
      },
      {
        id: "type",
        label: "Interview Type",
        type: "select",
        options: [
          { label: "System Design", value: "System Design" },
          { label: "Coding / Algorithms", value: "Coding / Algorithms" },
          { label: "AI / Machine Learning", value: "AI / Machine Learning" },
          { label: "Frontend Architecture", value: "Frontend Architecture" },
          { label: "Backend Architecture", value: "Backend Architecture" },
          { label: "Database Design", value: "Database Design" },
          { label: "Other", value: "Other" },
        ],
        allowCustom: true,
        required: true,
      },
      {
        id: "level",
        label: "Seniority Level",
        type: "select",
        options: [
          { label: "Intern", value: "Intern" },
          { label: "Junior", value: "Junior" },
          { label: "Mid-Level", value: "Mid-Level" },
          { label: "Senior", value: "Senior" },
          { label: "Staff", value: "Staff" },
          { label: "Principal", value: "Principal" },
        ],
        allowCustom: false,
        required: true,
      }
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Mock Tech Interview\nAction: Act as a technical interviewer. Present a technical problem (coding, system design, or AI engineering) appropriate for the seniority level. Guide the user, ask follow-up questions about trade-offs, and provide direct guidance on how to ace the problem. If a JD URL is provided, scrape it to tailor the problem.`,
    generatePrompt: (data) => {
      let prompt = `Let's start a ${data.level} level ${data.type} mock interview.\n\n`;
      if (data.jdUrl) prompt += `Job Description URL:\n${data.jdUrl}\n\n`;
      prompt += `Please give me a problem to solve.`;
      return prompt;
    },
    enableSearch: true,
    suggestedPrompts: [
      "Can I get a hint on the optimal time complexity?",
      "What are the trade-offs of using a NoSQL database here?",
      "How would this system scale to 1 million users?",
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
        placeholder: "Name, Email, Phone, LinkedIn, GitHub, Portfolio...",
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
        placeholder: "Languages, frameworks, tools, certifications...",
        required: false,
      }
    ],
    systemInstruction: `${basePersona}\n\nWorkflow: Resume Generator\nAction: You are an expert resume writer. Scaffold a clean, professional, Markdown-formatted resume from the provided information.

CRITICAL RULE — DO NOT generate or invent bullet points for work experience. Copy the user's responsibilities exactly as provided. If responsibilities are empty or missing for a role, output a single placeholder line: "- [Add your achievements here — or ask the AI Coach to suggest bullet points]". Never fabricate achievements, metrics, or responsibilities.

Format the resume structure and all other sections (contact, education, skills, summary if requested) according to the requested template style. When the user later asks you to improve or generate bullet points, you may then craft high-impact, metric-driven content using the XYZ formula. When updating the resume, always return the complete updated markdown.`,
    generatePrompt: (data) => {
      const { template, targetRole, personalInfo, workHistory, education, skills, jobDescription, uploadedResumeText } = data;

      const contactSection = `
NAME: ${personalInfo.name}
EMAIL: ${personalInfo.email}
PHONE: ${personalInfo.phone || 'Not provided'}
LINKEDIN: ${personalInfo.linkedin || 'Not provided'}
GITHUB: ${personalInfo.github || 'Not provided'}
PORTFOLIO: ${personalInfo.portfolio || 'Not provided'}
`.trim();

      const workSection = Array.isArray(workHistory)
        ? workHistory.map((w, i) => `
JOB #${i + 1}:
Role: ${w.role}
Company: ${w.company || 'Not specified'}
Dates: ${w.startDate || 'N/A'} - ${w.endDate || 'Present'}
Responsibilities: ${w.responsibilities || '[EMPTY]'}
`.trim()).join("\n\n")
        : workHistory;

      const eduSection = Array.isArray(education)
        ? education.map((e, i) => `
EDUCATION #${i + 1}:
Degree: ${e.degree || 'Degree Not Specified'}
University: ${e.university}
Year: ${e.year || 'N/A'}
`.trim()).join("\n\n")
        : education;

      const templateInstruction = template === "Match uploaded style" && uploadedResumeText
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
${skills || 'Not provided'}
${jobDescription ? `\n--- TARGET JOB DESCRIPTION (for keyword alignment in skills/summary only) ---\n${jobDescription}` : ""}
`.trim();
    },
    suggestedPrompts: [
      "Can we make the bullet points sound more impactful?",
      "Add a professional summary at the top.",
      "Summarize my older experience to keep it to one page.",
    ]
  },

  cover_letter: {
    id: "cover_letter",
    title: "Cover Letter Creator",
    description: "Generate a tailored, one-page cover letter from your resume or profile and the job description.",
    fields: [],
    systemInstruction: `${basePersona}

Workflow: Cover Letter Generator
Action: Write a compelling, authentic cover letter using ONLY the candidate's real experience. Never invent achievements, metrics, or job responsibilities.

STRUCTURE — strictly one page, 350–420 words total:
1. OPENING HOOK (2–3 sentences): Name the specific role and company. Lead with the single most relevant credential or concrete achievement. Never open with "I am writing to apply for…" or any variation.
2. BODY PARAGRAPH 1: Connect 2–3 of the candidate's strongest, directly relevant experiences to requirements stated in the job description. Mirror JD keywords verbatim.
3. BODY PARAGRAPH 2: Highlight one specific measurable achievement from the candidate's background (use the provided achievement if given, otherwise pick the strongest from their experience). Tie it to the company's mission or product area.
4. CLOSING (2–3 sentences): Restate alignment, express specific and genuine enthusiasm, include a clear call to action.

TONE MAP:
- professional → formal, measured, minimal contractions
- conversational → warm, direct, light contractions, approachable voice
- enthusiastic → forward-looking, energetic, one exclamation mark maximum

RULES:
- Mirror JD keywords verbatim (e.g. if JD says "distributed systems", use "distributed systems").
- Hard cap: 450 words.
- Return the COMPLETE letter wrapped in exactly one \`\`\`markdown fence. Nothing outside that fence.
- No date line, no postal address block unless the user requests it.
- If experience data is insufficient to fill a section honestly, insert a bracketed placeholder: [Add your strongest relevant achievement here].
- When generating follow-up revisions, always return the full updated letter in a new \`\`\`markdown fence.`,
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
};
