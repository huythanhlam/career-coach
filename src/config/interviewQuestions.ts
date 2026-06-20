// A bank of common behavioral interview questions, grouped by competency, so a
// user can practice specific questions instead of the (default, recommended)
// random set. The interviewer still rephrases each one to fit the target role.

export interface QuestionCategory {
  category: string;
  questions: string[];
}

export const QUESTION_BANK: QuestionCategory[] = [
  {
    category: "Classic / General",
    questions: [
      "Tell me about yourself.",
      "Why are you interested in this role?",
      "What are your greatest strengths?",
      "Tell me about a weakness and how you're working on it.",
      "Tell me about a time you failed and what you learned from it.",
      "Tell me about an accomplishment you're proud of.",
    ],
  },
  {
    category: "Leadership",
    questions: [
      "Tell me about a time you led a team through a difficult situation.",
      "Describe a time you had to motivate someone who was disengaged.",
      "Give an example of a tough decision you made and how you handled it.",
      "Tell me about a time you mentored or developed someone.",
    ],
  },
  {
    category: "Conflict Resolution",
    questions: [
      "Tell me about a time you disagreed with a colleague. How did you resolve it?",
      "Describe a conflict with a manager or stakeholder and how you handled it.",
      "Tell me about a time you received difficult feedback.",
      "Describe a situation where you had to work with someone difficult.",
    ],
  },
  {
    category: "Teamwork",
    questions: [
      "Tell me about a time you collaborated with others to achieve a shared goal.",
      "Describe a time you helped a struggling teammate.",
      "Tell me about a time you had to compromise to keep a team moving.",
    ],
  },
  {
    category: "Problem Solving",
    questions: [
      "Tell me about a complex problem you solved.",
      "Describe a time you had to make a decision with incomplete information.",
      "Tell me about a time you improved a process or fixed something broken.",
    ],
  },
  {
    category: "Adaptability",
    questions: [
      "Tell me about a time you had to adapt to a significant change.",
      "Describe a time your priorities shifted unexpectedly. How did you respond?",
      "Tell me about a time you stepped outside your comfort zone.",
    ],
  },
  {
    category: "Time Management",
    questions: [
      "Tell me about a time you juggled multiple competing deadlines.",
      "Describe a time you had to prioritize under pressure.",
      "Tell me about a time you missed a deadline and how you handled it.",
    ],
  },
  {
    category: "Communication",
    questions: [
      "Tell me about a time you explained something complex to a non-expert.",
      "Describe a time clear communication prevented a problem.",
      "Tell me about a time you had to deliver bad news.",
    ],
  },
];
