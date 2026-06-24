import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  FileText,
  LineChart,
  Building,
  Building2,
  Briefcase,
  DollarSign,
  Users,
  PenTool,
  ShieldCheck,
  Compass,
  ChevronRight,
  Star,
  Check,
  X,
  Menu,
  Zap,
  Target,
  Megaphone,
  Rocket,
  TrendingUp,
  Mail,
  ArrowRight,
} from "lucide-react";
import type { AccountType } from "@/types/userProfile";
import { setPendingAccountType } from "@/lib/accountMode";

type AuthMode = "sign_in" | "sign_up" | "forgot_password";

interface AuthModalProps {
  onClose: () => void;
  pendingTab?: string;
  intent?: AccountType;
}

function AuthModal({ onClose, pendingTab, intent = "seeker" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("sign_up");
  const [accountIntent, setAccountIntent] = useState<AccountType>(intent);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const isEmployer = accountIntent === "employer";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (pendingTab) {
      localStorage.setItem("pendingTab", pendingTab);
    }
    // Carry the chosen account type through signup → onboarding.
    setPendingAccountType(accountIntent);

    if (mode === "sign_in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: error.message, error: true });
    } else if (mode === "sign_up") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage({ text: error.message, error: true });
      else setMessage({ text: "Check your email to confirm your account.", error: false });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setMessage({ text: error.message, error: true });
      else setMessage({ text: "Password reset email sent.", error: false });
    }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(31,27,22,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 sm:p-8 relative"
        style={{ background: "var(--background)", border: "1px solid var(--border)", boxShadow: "0 24px 80px rgba(0,0,0,0.15)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">TechCoach AI</span>
          </div>

          {/* Account intent — a clear, distinct path for candidates vs employers */}
          {mode !== "forgot_password" && (
            <div role="group" aria-label="Account type" className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
              {([
                { type: "seeker" as AccountType, icon: Briefcase, label: "I'm a candidate" },
                { type: "employer" as AccountType, icon: Building2, label: "I'm an employer" },
              ]).map(({ type, icon: Icon, label }) => {
                const active = accountIntent === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountIntent(type)}
                    aria-pressed={active}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      height: 34,
                      background: active ? "var(--card)" : "transparent",
                      color: active ? "var(--primary)" : "var(--muted-foreground)",
                      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                );
              })}
            </div>
          )}

          <h2 className="font-display text-2xl font-semibold text-foreground">
            {mode === "sign_in"
              ? "Welcome back"
              : mode === "forgot_password"
                ? "Reset password"
                : isEmployer ? "Hire with TechCoach AI" : "Start for free"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "sign_in"
              ? "Sign in to your account"
              : mode === "forgot_password"
                ? "Enter your email to reset"
                : isEmployer ? "Create your employer account — post jobs and reach candidates" : "Create your free account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 14,
              height: 44, fontSize: 14, padding: "0 14px", color: "var(--foreground)", width: "100%",
              outline: "none", fontFamily: "inherit",
            }}
          />
          {mode !== "forgot_password" && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 14,
                height: 44, fontSize: 14, padding: "0 14px", color: "var(--foreground)", width: "100%",
                outline: "none", fontFamily: "inherit",
              }}
            />
          )}

          {message && (
            <div
              className="text-sm rounded-xl px-3 py-2"
              style={{
                background: message.error ? "rgba(244,63,94,0.08)" : "rgba(47,107,79,0.08)",
                color: message.error ? "#F43F5E" : "#2F6B4F",
                border: `1px solid ${message.error ? "rgba(244,63,94,0.2)" : "rgba(47,107,79,0.2)"}`,
              }}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--primary)", color: "#fff", border: "none", borderRadius: 14,
              height: 44, fontSize: 14, fontWeight: 600, width: "100%", cursor: "pointer",
              fontFamily: "inherit", opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Please wait…" : mode === "sign_in" ? "Sign In" : mode === "sign_up" ? "Create Account" : "Send Reset Email"}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {mode === "sign_in" && (
            <>
              <button onClick={() => setMode("forgot_password")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </button>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button onClick={() => setMode("sign_up")} className="font-semibold" style={{ color: "var(--primary)" }}>
                  Sign up free
                </button>
              </p>
            </>
          )}
          {mode === "sign_up" && (
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => setMode("sign_in")} className="font-semibold" style={{ color: "var(--primary)" }}>
                Sign in
              </button>
            </p>
          )}
          {mode === "forgot_password" && (
            <button onClick={() => setMode("sign_in")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Feature {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  tab: string;
}

const features: Feature[] = [
  {
    id: "resume_generation",
    icon: PenTool,
    title: "AI Resume Builder",
    description: "Generate a polished resume from scratch using your career history — built to pass automated screening filters and impress recruiters. Choose from 6 professional templates.",
    color: "#D97757",
    tab: "resume_generation",
  },
  {
    id: "resume",
    icon: FileText,
    title: "Resume Analyzer",
    description: "Upload your resume and a job description. Get a gap analysis, rewritten bullet points that clearly show your impact and results, and a match score.",
    color: "#2F6B4F",
    tab: "resume",
  },
  {
    id: "company_research",
    icon: Building,
    title: "Research Company",
    description: "Live research on what a company values when hiring, its benefits, role-relevant news, and recent financials — every claim linked to a verifiable source.",
    color: "#E8B948",
    tab: "company_research",
  },
  {
    id: "market",
    icon: LineChart,
    title: "Market Compensation",
    description: "Get real salary bands, equity benchmarks, and cost-of-living comparisons for any role across US markets.",
    color: "#3B82F6",
    tab: "market",
  },
  {
    id: "salary",
    icon: DollarSign,
    title: "Salary Negotiation",
    description: "Paste your offer letter and target comp. Get a full negotiation strategy, email templates, and counter-offer scripts.",
    color: "#2F6B4F",
    tab: "salary",
  },
  {
    id: "interview",
    icon: Target,
    title: "Interview & Job Search",
    description: "Get a personalized week-by-week job search plan, guided practice for behavioral interview questions, and recommended certifications.",
    color: "#8B5CF6",
    tab: "interview",
  },
  {
    id: "mock_behavioral",
    icon: Users,
    title: "Mock Interview",
    description: "Sit a realistic, spoken behavioral interview with an AI that asks role-specific questions, then get STAR-rated feedback on every answer.",
    color: "#D97757",
    tab: "mock_behavioral",
  },
  {
    id: "goal_planning",
    icon: Target,
    title: "Career Goal Planning",
    description: "Turn your up-to-date profile into a personalized development plan — then coach through learning a skill, changing roles, or earning a promotion.",
    color: "#3B82F6",
    tab: "goal_planning",
  },
  {
    id: "linkedin",
    icon: ShieldCheck,
    title: "LinkedIn Optimizer",
    description: "Rewrite your headline, About section, and experience with keyword-rich language that attracts recruiters.",
    color: "#0A66C2",
    tab: "linkedin",
  },
];

const testimonials = [
  {
    name: "Sarah K.",
    role: "Marketing Coordinator → Marketing Manager",
    quote: "TechCoach AI helped me negotiate $40k more in total compensation. The salary strategy was incredibly specific and gave me the confidence to push back.",
    stars: 5,
  },
  {
    name: "Marcus L.",
    role: "Operations Lead → Director of Operations",
    quote: "The resume analyzer caught issues I'd missed for years. The rewritten bullet points made my impact 10x clearer.",
    stars: 5,
  },
  {
    name: "Priya M.",
    role: "Project Manager",
    quote: "Company research saved me from a bad hire. Found red flags in Glassdoor reviews I would have missed. Now at a company I actually love.",
    stars: 5,
  },
];

const steps = [
  {
    number: "01",
    title: "Create your free account",
    description: "Sign up in 30 seconds — no credit card required. Your profile is private and secure.",
    icon: Zap,
  },
  {
    number: "02",
    title: "Choose your tool",
    description: "Pick from 10 AI-powered career tools. Each one is built for a specific stage of the job search.",
    icon: Target,
  },
  {
    number: "03",
    title: "Get actionable results",
    description: "Receive detailed, specific guidance you can act on immediately — not generic advice.",
    icon: TrendingUp,
  },
];

interface LandingPageProps {
  onSignIn?: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | undefined>(undefined);
  const [authIntent, setAuthIntent] = useState<AccountType>("seeker");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactSent, setContactSent] = useState(false);

  function openAuth(tab?: string, intent: AccountType = "seeker") {
    setPendingTab(tab);
    setAuthIntent(intent);
    setAuthOpen(true);
    setMobileMenuOpen(false);
  }

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactSent(true);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* ── Navigation ── */}
      <nav
        className="sticky top-0 z-40 border-b"
        style={{ background: "rgba(251,247,241,0.92)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--primary)" }}
            >
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-lg">TechCoach AI</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {["Features", "How It Works", "Testimonials", "About"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/ /g, "-")}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
            <a
              href="#for-employers"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" /> For Employers
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="#/blog"
              className="text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-muted"
            >
              Blog
            </a>
            <button
              onClick={() => openAuth()}
              className="text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-muted"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuth()}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--primary)" }}
            >
              Get Started Free
            </button>
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t px-4 py-4 space-y-3" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
            {["Features", "How It Works", "Testimonials", "About", "Contact"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/ /g, "-")}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm text-muted-foreground hover:text-foreground py-1"
              >
                {label}
              </a>
            ))}
            <a
              href="#for-employers"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground py-1"
            >
              For Employers
            </a>
            <button
              onClick={() => openAuth()}
              className="w-full text-sm font-semibold py-2.5 rounded-xl text-white"
              style={{ background: "var(--primary)" }}
            >
              Get Started Free
            </button>
            <button
              onClick={() => openAuth(undefined, "employer")}
              className="w-full text-sm font-semibold py-2.5 rounded-xl"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Post a job
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: "rgba(217,119,87,0.1)", color: "var(--primary)", border: "1px solid rgba(217,119,87,0.2)" }}
        >
          <Zap className="w-3 h-3" /> Powered by Gemini AI · Free to start
        </div>

        <h1
          className="font-display text-4xl sm:text-6xl lg:text-7xl font-semibold leading-tight mb-6"
          style={{ color: "var(--foreground)" }}
        >
          Land your dream{" "}
          <span style={{ color: "var(--primary)" }}>job</span>
          <br />with an AI career coach
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          10 AI-powered tools that cover every stage of the job search — from resume building to salary negotiation.
          Specific, data-backed guidance. Not generic career advice.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => openAuth()}
            className="flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
            style={{ background: "var(--primary)", boxShadow: "0 12px 40px rgba(217,119,87,0.35)" }}
          >
            Start for Free <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#features"
            className="flex items-center gap-2 text-base font-medium px-8 py-4 rounded-2xl transition-colors hover:bg-muted"
            style={{ border: "1px solid var(--border)" }}
          >
            See all features <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {[
            { value: "10+", label: "AI-powered tools" },
            { value: "$40k+", label: "Avg. comp increase" },
            { value: "100%", label: "Free to start" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="font-display text-3xl font-bold" style={{ color: "var(--primary)" }}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20" style={{ background: "var(--paper)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="eyebrow mb-3">How It Works</p>
            <h2 className="font-display text-4xl font-semibold">Get results in minutes, not weeks</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(217,119,87,0.1)" }}
                >
                  <step.icon className="w-6 h-6" style={{ color: "var(--primary)" }} />
                </div>
                <div className="font-display text-5xl font-bold mb-3" style={{ color: "rgba(217,119,87,0.15)" }}>
                  {step.number}
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => openAuth()}
              className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-white hover:opacity-90 transition-opacity"
              style={{ background: "var(--primary)" }}
            >
              Try it now — it's free <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="eyebrow mb-3">Features</p>
          <h2 className="font-display text-4xl font-semibold">Every tool you need to land the job</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            10 specialized AI coaches, each built for a critical job-search task. Click any card to try it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <button
              key={f.id}
              onClick={() => openAuth(f.tab)}
              className="text-left rounded-2xl p-6 border transition-all hover:shadow-lg hover:-translate-y-0.5 group"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: `${f.color}18` }}
              >
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{f.description}</p>
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: f.color }}
              >
                Try it free <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── For Employers ── */}
      <section id="for-employers" className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="rounded-3xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "rgba(217,119,87,0.30)" }}
        >
          <div className="grid md:grid-cols-2 gap-10 p-8 sm:p-12 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ background: "rgba(217,119,87,0.1)", color: "var(--primary)", border: "1px solid rgba(217,119,87,0.2)" }}
              >
                <Building2 className="w-3 h-3" /> For Employers
              </div>
              <h2 className="font-display text-4xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Hiring? Post jobs and reach candidates
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Set up your company profile, write compelling job listings with AI, and promote and
                boost them to get in front of the right people — all in a dedicated Employer Studio.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  { icon: PenTool, text: "AI-drafted job descriptions and company profiles" },
                  { icon: Megaphone, text: "Generate promo content for every listing" },
                  { icon: Rocket, text: "Boost listings to feature them with candidates" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(217,119,87,0.12)" }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                    </div>
                    <span className="mt-1">{text}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => openAuth(undefined, "employer")}
                  className="inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 rounded-xl text-white hover:opacity-90 transition-opacity"
                  style={{ background: "var(--primary)" }}
                >
                  Create employer account <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openAuth(undefined, "employer")}
                  className="inline-flex items-center justify-center gap-2 font-medium px-6 py-3 rounded-xl transition-colors hover:bg-muted"
                  style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  Post a job
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Company profiles", value: "AI-built", icon: Building2, color: "var(--primary)" },
                { label: "Job listings", value: "From a brief", icon: FileText, color: "var(--forest)" },
                { label: "Promotion", value: "1-click", icon: Megaphone, color: "#3B82F6" },
                { label: "Boosted reach", value: "Featured", icon: Rocket, color: "#E8B948" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl p-5 border" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="font-display text-lg font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-20" style={{ background: "var(--paper)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="eyebrow mb-3">Testimonials</p>
            <h2 className="font-display text-4xl font-semibold">Real results from real people</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl p-6 border"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" style={{ color: "var(--highlight)" }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--foreground)" }}>
                  "{t.quote}"
                </p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="eyebrow mb-3">About Us</p>
            <h2 className="font-display text-4xl font-semibold mb-6">
              Built for ambitious professionals, by people who've been there
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              TechCoach AI was built because we saw how broken the job search is. Candidates spend hundreds of hours
              on resumes, preparation, and negotiation — often alone, without expert guidance.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              We built 10 AI-powered tools that give every professional access to the same caliber
              of career coaching that used to cost thousands of dollars or require a referral from the right person.
            </p>
            <ul className="space-y-3">
              {[
                "AI trained on thousands of successful job searches",
                "Grounded in real salary data and market intelligence",
                "Built with privacy-first principles — your data stays yours",
                "Free to start, no credit card required",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(47,107,79,0.12)" }}
                  >
                    <Check className="w-3 h-3" style={{ color: "var(--forest)" }} />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Resume analyses", value: "10k+", color: "var(--primary)" },
              { label: "Offer negotiations coached", value: "2.5k+", color: "var(--forest)" },
              { label: "Interview sessions", value: "8k+", color: "#E8B948" },
              { label: "Companies researched", value: "5k+", color: "#3B82F6" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-2xl p-6 border"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="font-display text-3xl font-bold mb-1" style={{ color }}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20" style={{ background: "var(--paper)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="eyebrow mb-3">Pricing</p>
          <h2 className="font-display text-4xl font-semibold mb-4">Free while in beta</h2>
          <p className="text-muted-foreground mb-12">
            All 10 tools are free during our public beta. No credit card required.
          </p>

          <div
            className="rounded-3xl p-8 border max-w-sm mx-auto"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="font-display text-5xl font-bold mb-1" style={{ color: "var(--primary)" }}>$0</div>
            <div className="text-muted-foreground text-sm mb-6">Forever free during beta</div>
            <ul className="space-y-3 mb-8 text-left">
              {[
                "All 10 AI career tools",
                "Unlimited sessions",
                "Resume builder & analyzer",
                "Company research",
                "Mock interview practice",
                "Salary negotiation scripts",
                "Market compensation data",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--forest)" }} />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => openAuth()}
              className="w-full font-semibold py-3 rounded-xl text-white hover:opacity-90 transition-opacity"
              style={{ background: "var(--primary)" }}
            >
              Get started free
            </button>
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <p className="eyebrow mb-3">Contact</p>
            <h2 className="font-display text-4xl font-semibold mb-4">We'd love to hear from you</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Have feedback, a feature request, or a partnership inquiry? Drop us a note.
            </p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" style={{ color: "var(--primary)" }} />
              hello@techcoach.ai
            </div>
          </div>

          <div
            className="rounded-2xl p-6 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            {contactSent ? (
              <div className="text-center py-8">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(47,107,79,0.1)" }}
                >
                  <Check className="w-6 h-6" style={{ color: "var(--forest)" }} />
                </div>
                <h3 className="font-semibold mb-2">Message sent!</h3>
                <p className="text-sm text-muted-foreground">We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    style={{
                      background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12,
                      height: 40, fontSize: 14, padding: "0 12px", color: "var(--foreground)", width: "100%",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    style={{
                      background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12,
                      height: 40, fontSize: 14, padding: "0 12px", color: "var(--foreground)", width: "100%",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Message</label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                    required
                    rows={4}
                    style={{
                      background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12,
                      fontSize: 14, padding: "10px 12px", color: "var(--foreground)", width: "100%",
                      outline: "none", fontFamily: "inherit", resize: "none",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full font-semibold py-3 rounded-xl text-white hover:opacity-90 transition-opacity text-sm"
                  style={{ background: "var(--primary)" }}
                >
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-12" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--primary)" }}>
                <Compass className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-semibold">TechCoach AI</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#/blog" className="hover:text-foreground transition-colors">Blog</a>
              <a href="#about" className="hover:text-foreground transition-colors">About</a>
              <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
              <button onClick={() => openAuth()} className="hover:text-foreground transition-colors">Sign In</button>
            </div>

            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} TechCoach AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          pendingTab={pendingTab}
          intent={authIntent}
        />
      )}
    </div>
  );
}
