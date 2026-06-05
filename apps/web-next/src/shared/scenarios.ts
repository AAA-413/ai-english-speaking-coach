import type { Scenario, ScenarioId } from "./practice";

export const scenarios = [
  {
    id: "job_interview",
    title: "Product Manager Interview",
    label: "Interview",
    description: "Practice self-introduction, project stories, follow-up questions, and closing questions.",
    aiRole: "interviewer",
    userRole: "candidate",
    level: "B1",
    goals: [
      "Give a 45-60 second self-introduction",
      "Explain one past project clearly",
      "Answer one follow-up question",
      "Ask one question back to the interviewer",
    ],
    keywords: ["cross-functional", "prioritize", "stakeholder", "impact"],
    rubric: {
      taskCompletion: 30,
      fluency: 20,
      grammar: 20,
      vocabulary: 15,
      interaction: 15,
    },
    openingPrompt: "Let's start with a short introduction. Tell me about yourself and your recent product work.",
    followUpQuestions: [
      "What was the hardest trade-off in that project?",
      "How did you measure whether the project worked?",
      "Tell me about a time you disagreed with an engineer or designer.",
    ],
    pronunciationSentences: [
      "I have spent the last three years working as a product manager.",
      "One project I am proud of improved user retention by simplifying onboarding.",
    ],
  },
  {
    id: "restaurant_ordering",
    title: "Cafe Ordering",
    label: "Ordering",
    description: "Practice ordering, asking for options, confirming details, and polite requests.",
    aiRole: "barista",
    userRole: "customer",
    level: "A2",
    goals: [
      "Order one drink clearly",
      "Specify size and milk preference",
      "Ask one follow-up question",
      "Confirm the final order",
    ],
    keywords: ["medium", "oat milk", "to go", "receipt"],
    rubric: {
      taskCompletion: 35,
      fluency: 20,
      grammar: 15,
      vocabulary: 15,
      interaction: 15,
    },
    openingPrompt: "Hi, welcome in. What can I get started for you today?",
    followUpQuestions: [
      "Would you like that hot or iced?",
      "What size would you like?",
      "Would you like anything else with that?",
    ],
    pronunciationSentences: [
      "Could I get a medium latte with oat milk, please?",
      "Can I have that to go?",
    ],
  },
  {
    id: "business_meeting",
    title: "Business Meeting",
    label: "Meeting",
    description: "Practice status updates, clarifying questions, disagreement, and next steps.",
    aiRole: "teammate",
    userRole: "project owner",
    level: "B2",
    goals: [
      "Give a concise status update",
      "Explain one blocker",
      "Respond to a suggestion",
      "Agree on next steps",
    ],
    keywords: ["timeline", "blocker", "alignment", "next steps"],
    rubric: {
      taskCompletion: 30,
      fluency: 20,
      grammar: 15,
      vocabulary: 20,
      interaction: 15,
    },
    openingPrompt: "Let's do a quick project sync. Can you give me the current status and the biggest blocker?",
    followUpQuestions: [
      "What support do you need from the team?",
      "Do you think the current timeline is still realistic?",
      "What should we decide before the end of this meeting?",
    ],
    pronunciationSentences: [
      "The main blocker is alignment on the revised timeline.",
      "I suggest we confirm the next steps before the end of the meeting.",
    ],
  },
] satisfies Scenario[];

export function getScenario(id: ScenarioId | string | undefined): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}
