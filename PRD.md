# TechCoach AI - Product Requirements Document (PRD)

This Product Requirements Document (PRD) is designed for autonomous AI consumption to build **TechCoach AI**.

---

## 1. System Overview & Architecture

TechCoach AI uses a **Client-Server-AI** architecture designed for cross-platform availability (Web/Mobile) and strict data privacy.

*   **Frontend:** React (Web) and React Native (Mobile) sharing a common TypeScript logic layer for state management and API clients.
*   **Backend:** Node.js (Express/FastAPI) REST API.
*   **Database:** PostgreSQL for relational user data, career history, and subscription status; Redis for real-time chat session state.
*   **AI Layer:** Orchestration layer using LangChain/LlamaIndex to interface with Google Gemini API.
*   **Privacy Gateway:** A middleware service that intercepts outgoing AI requests to scrub PII (Names, Emails, Phone numbers) using regex and NER (Named Entity Recognition) before sending data to LLMs.

---

## 2. User Roles & Permissions

| Role | Permissions |
| :--- | :--- |
| **Guest** | View landing page, preview templates, 1x basic resume analysis (read-only). |
| **Free User** | Create/Edit 1 Resume, 1 Cover Letter. Access limited "Career Advice" chat (3 msgs/day). View basic market data. |
| **Premium User** | Unlimited Resumes/Cover Letters. Full Mock Interview Simulator. Advanced Salary Negotiation. Unlimited Coach Chat. |
| **Admin** | Manage users, view system analytics (anonymized), update job market datasets. |

---

## 3. Data Models & Database Schema

### Table: `users`
*   `id` (UUID, PK)
*   `email` (String, Unique)
*   `password_hash` (String)
*   `subscription_tier` (Enum: 'free', 'premium')
*   `pii_vault_id` (UUID, FK) - *Reference to encrypted PII table*

### Table: `career_profiles`
*   `id` (UUID, PK)
*   `user_id` (UUID, FK)
*   `raw_resume_json` (JSONB) - *Stored skills, experience, education*
*   `target_roles` (Array[String])

### Table: `resumes` / `cover_letters`
*   `id` (UUID, PK)
*   `user_id` (UUID, FK)
*   `job_description_raw` (Text)
*   `content_markdown` (Text)
*   `version` (Int)

### Table: `interview_sessions`
*   `id` (UUID, PK)
*   `user_id` (UUID, FK)
*   `job_title` (String)
*   `transcript` (JSONB)
*   `feedback_report` (Text)

---

## 4. Core API Endpoints

### Authentication & Billing
*   `POST /api/auth/register` | Body: `{email, password}` | Returns: `JWT`
*   `POST /api/billing/subscribe` | Body: `{payment_token}` | Returns: `Status`

### AI Career Services
*   `POST /api/resume/generate`
    *   **Payload:** `{profile_id, job_description, template_id}`
    *   **Response:** `{markdown_content, analysis_report}`
*   `POST /api/coach/chat`
    *   **Payload:** `{session_id, message}`
    *   **Response:** `{response_text, suggested_actions}`
*   `POST /api/interview/start`
    *   **Payload:** `{job_title, company_context}`
    *   **Response:** `{session_id, first_question}`

---

## 5. Frontend Component Tree

*   **AppShell (Stateful: AuthContext)**
    *   **Sidebar/Navigation (Presentational)**
    *   **DashboardView (Stateful: UserStats)**
        *   **QuickActions (Presentational)**
        *   **ApplicationTracker (Stateful)**
    *   **ResumeWorkspace (Stateful: EditorState)**
        *   **JDPane (Stateful: Input)**
        *   **AILivePreview (Presentational: Markdown)**
        *   **RefinementPanel (Stateful: Chat)**
    *   **InterviewSim (Stateful: MediaStream/Transcript)**
        *   **VideoFeed (Presentational)**
        *   **QuestionDisplay (Presentational)**
        *   **RealTimeFeedback (Stateful)**
    *   **SettingsView (Stateful)**
        *   **PIIManagement (Stateful)**

---

## 6. User Stories & Acceptance Criteria

### Story 1: Tailored Resume Generation
**As a** Job Seeker, **I want to** generate a resume tailored to a specific job description **so that** I pass ATS filters.

*   **AC 1:** Given the user has uploaded a master resume and provided a Job Description, When they click "Tailor Resume", Then the system must return a version highlighting matching keywords.
*   **AC 2:** Given the AI is processing, When PII is detected in the resume, Then the Privacy Gateway must mask it before sending it to the Gemini API.

### Story 2: Mock Interview Feedback
**As a** Candidate, **I want to** practice an interview for a specific role **so that** I can improve my confidence and answers.

*   **AC 1:** Given a "Software Engineer" role, When the user answers a question via voice/text, Then the AI must provide a score (1-10) and a "better way to say it" suggestion.

---

## 7. Edge Cases & Error Handling

*   **AI Hallucination:** If AI output is non-markdown or contains gibberish, the parser must fallback to the previous version and notify the user to "Retry with more context."
*   **PII Scrubbing False Positives:** Users must have an "Override Masking" toggle for specific professional nouns that might look like names.
*   **Empty State:** New users with no history must see a "Start with LinkedIn Import" or "Quick-Start Wizard" instead of an empty dashboard.
*   **API Timeout:** Large resume generations exceeding 30s must trigger a background job with a WebSocket notification upon completion.

---

## 8. Third-Party Integrations

1.  **Google Gemini API:** Primary LLM for resume tailoring and career coaching.
2.  **Stripe API:** Subscription management and secure payment processing.
3.  **Auth0 / Firebase Auth:** Social login (LinkedIn, Google) and JWT management.
4.  **SerpApi / Job Boards:** To fetch live job descriptions and company news for the "Scoping" feature.
5.  **Presidio (Microsoft):** Open-source PII identification for the Privacy Gateway.
