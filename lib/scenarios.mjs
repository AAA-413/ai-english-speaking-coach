export const scenarios = [
  {
    id: "job_interview",
    title: "Product Manager Interview",
    titleZh: "产品经理面试",
    label: "Interview",
    labelZh: "面试",
    description: "Practice self-introduction, project stories, follow-up questions, and closing questions.",
    descriptionZh: "练习自我介绍、项目经历、追问回答和反问面试官。",
    aiRole: "interviewer",
    aiRoleZh: "面试官",
    userRole: "candidate",
    userRoleZh: "候选人",
    level: "B1",
    goals: [
      "Give a 45-60 second self-introduction",
      "Explain one past project clearly",
      "Answer one follow-up question",
      "Ask one question back to the interviewer",
    ],
    goalsZh: [
      "完成 45-60 秒英文自我介绍",
      "清楚讲述一个过往项目",
      "回答一个追问",
      "向面试官反问一个问题",
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
    titleZh: "咖啡点餐",
    label: "Ordering",
    labelZh: "点餐",
    description: "Practice ordering, asking for options, confirming details, and polite requests.",
    descriptionZh: "练习点单、询问选项、确认细节和礼貌表达。",
    aiRole: "barista",
    aiRoleZh: "咖啡师",
    userRole: "customer",
    userRoleZh: "顾客",
    level: "A2",
    goals: [
      "Order one drink clearly",
      "Specify size and milk preference",
      "Ask one follow-up question",
      "Confirm the final order",
    ],
    goalsZh: [
      "清楚点一杯饮品",
      "说明杯型和牛奶偏好",
      "提出一个追问",
      "确认最终订单",
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
    titleZh: "商务会议",
    label: "Meeting",
    labelZh: "会议",
    description: "Practice status updates, clarifying questions, disagreement, and next steps.",
    descriptionZh: "练习状态同步、澄清问题、表达不同意见和确认下一步。",
    aiRole: "teammate",
    aiRoleZh: "同事",
    userRole: "project owner",
    userRoleZh: "项目负责人",
    level: "B2",
    goals: [
      "Give a concise status update",
      "Explain one blocker",
      "Respond to a suggestion",
      "Agree on next steps",
    ],
    goalsZh: [
      "简洁同步项目状态",
      "说明一个阻塞点",
      "回应一个建议",
      "确认下一步行动",
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
];

export function getScenario(id) {
  return scenarios.find((scenario) => scenario.id === id);
}

export function buildRealtimeInstructions({ scenario, level, correctionMode }) {
  const correctionPolicy = {
    immersive: "Do not correct during the conversation unless the learner cannot be understood.",
    coach: "Every 2-3 user turns, give one short correction before continuing the role-play.",
    post_session: "Do not interrupt with corrections. Save feedback for the post-session report.",
  }[correctionMode] || "Save feedback for the post-session report.";

  return [
    `You are an English speaking coach playing the role of ${scenario.aiRole}.`,
    `The learner is the ${scenario.userRole}.`,
    `Scenario: ${scenario.title}.`,
    `Target level: ${level || scenario.level}.`,
    "Stay in role and keep the conversation realistic.",
    "Keep every spoken response under 2-3 sentences.",
    "Ask one question at a time.",
    "Use natural English, not classroom lectures.",
    correctionPolicy,
    `Goals: ${scenario.goals.join("; ")}.`,
    `Useful vocabulary: ${scenario.keywords.join(", ")}.`,
    `Start with: ${scenario.openingPrompt}`,
  ].join("\n");
}
