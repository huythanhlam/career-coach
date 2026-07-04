import {
  FileText,
  LineChart,
  Building,
  DollarSign,
  Users,
  PenTool,
  ShieldCheck,
  Target,
  Zap,
  TrendingUp,
} from "lucide-react";

// Static marketing content for the landing page. Feature copy is outcome-led
// (what the visitor gets) rather than tool-name-led, and each feature is tagged
// with the candidate-journey stage it belongs to so the Features section can be
// grouped the same way the in-app sidebar is (Plan → Apply → Practice → Research).

export type Stage = "Plan" | "Apply" | "Practice" | "Research";

/** Canonical stage order — mirrors the app sidebar. */
export const STAGES: readonly Stage[] = ["Plan", "Apply", "Practice", "Research"];

/** Vignette ids for the marquee tiles that render a mini animated UI preview. */
export type VignetteId = "resume" | "interview" | "market" | "salary";

export interface Feature {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  /** Auth-modal pending tab, opened when the tile is clicked. */
  tab: string;
  stage: Stage;
  /** Present on the four large bento tiles that show a live UI vignette. */
  vignette?: VignetteId;
}

export const features: Feature[] = [
  {
    id: "goal_planning",
    icon: Target,
    title: "Know your next move before you make it",
    description:
      "Turn your profile into a week-by-week development plan, then coach through learning a skill, changing roles, or earning the promotion.",
    color: "#3B82F6",
    tab: "goal_planning",
    stage: "Plan",
  },
  {
    id: "resume_generation",
    icon: PenTool,
    title: "A resume that gets past the filters",
    description:
      "Build a polished resume from your history — shaped to clear automated screening and hold a recruiter's attention. Six professional templates.",
    color: "#D97757",
    tab: "resume_generation",
    stage: "Apply",
  },
  {
    id: "resume",
    icon: FileText,
    title: "See exactly why you're not getting callbacks",
    description:
      "Drop in your resume and a job description for a gap analysis, rewritten impact bullets, and a match score you can act on.",
    color: "#2F6B4F",
    tab: "resume",
    stage: "Apply",
    vignette: "resume",
  },
  {
    id: "linkedin",
    icon: ShieldCheck,
    title: "Get found by the right recruiters",
    description:
      "Rewrite your headline, About, and experience with keyword-rich language that surfaces you in recruiter searches.",
    color: "#0A66C2",
    tab: "linkedin",
    stage: "Apply",
  },
  {
    id: "mock_behavioral",
    icon: Users,
    title: "Walk in already knowing your answers land",
    description:
      "Sit a realistic spoken behavioral interview with an AI that asks role-specific questions, then rates every answer against STAR.",
    color: "#D97757",
    tab: "mock_behavioral",
    stage: "Practice",
    vignette: "interview",
  },
  {
    id: "interview",
    icon: Zap,
    title: "A job-search plan that tells you what to do today",
    description:
      "Get a personalized week-by-week search plan, guided behavioral practice, and the certifications worth your time.",
    color: "#8B5CF6",
    tab: "interview",
    stage: "Practice",
  },
  {
    id: "market",
    icon: LineChart,
    title: "Know what the role actually pays",
    description:
      "Real salary bands, equity benchmarks, and cost-of-living comparisons for any role across US markets — before you name a number.",
    color: "#3B82F6",
    tab: "market",
    stage: "Research",
    vignette: "market",
  },
  {
    id: "salary",
    icon: DollarSign,
    title: "Walk into the negotiation with a script",
    description:
      "Paste your offer and target comp for a full negotiation strategy, email templates, and counter-offer scripts backed by market data.",
    color: "#2F6B4F",
    tab: "salary",
    stage: "Research",
    vignette: "salary",
  },
  {
    id: "company_research",
    icon: Building,
    title: "Never walk into a company blind",
    description:
      "Live research on what a company values in hiring, its benefits, role-relevant news, and financials — every claim linked to its source.",
    color: "#E8B948",
    tab: "company_research",
    stage: "Research",
  },
];

export interface StageGroup {
  stage: Stage;
  features: Feature[];
}

/**
 * Group features under their journey stage in canonical order. Stages with no
 * features are omitted. Pure — unit-tested in content.test.ts.
 */
export function featuresByStage(list: readonly Feature[] = features): StageGroup[] {
  return STAGES.map((stage) => ({
    stage,
    features: list.filter((f) => f.stage === stage),
  })).filter((g) => g.features.length > 0);
}

/** The marquee tiles that render a live UI vignette, in display order. */
export function marqueeFeatures(list: readonly Feature[] = features): Feature[] {
  return list.filter((f) => f.vignette);
}

export interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

export const steps: Step[] = [
  {
    number: "01",
    title: "Create your free account",
    description: "Sign up in 30 seconds — no credit card. Your profile stays private and secure.",
    icon: Zap,
  },
  {
    number: "02",
    title: "Pick the tool for where you are",
    description:
      "Ten AI coaches, each built for one stage of the search — from first resume to final offer.",
    icon: Target,
  },
  {
    number: "03",
    title: "Act on specifics, not platitudes",
    description:
      "Get concrete, data-backed guidance you can use the same day — never generic career advice.",
    icon: TrendingUp,
  },
];

/** Honest, verifiable proof points that replace the old fabricated stat wall. */
export const proofPoints: readonly string[] = [
  "Powered by Gemini",
  "Free while in beta",
  "Private by default",
];
