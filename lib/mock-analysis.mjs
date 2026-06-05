const correctionExamples = {
  job_interview: {
    type: "grammar",
    severity: "medium",
    original: "I am work as product manager for three years.",
    corrected: "I have worked as a product manager for three years.",
    explanationZh: "表达持续到现在的经历，用现在完成时；product manager 前需要冠词 a。",
    betterExpression: "I've spent the last three years working as a product manager.",
  },
  restaurant_ordering: {
    type: "expression",
    severity: "low",
    original: "I want medium latte oat milk.",
    corrected: "Could I get a medium latte with oat milk, please?",
    explanationZh: "点餐时用 could I get 更自然，with oat milk 表示加燕麦奶。",
    betterExpression: "Could I get that with oat milk, please?",
  },
  business_meeting: {
    type: "expression",
    severity: "medium",
    original: "We delay because design not confirm.",
    corrected: "We are delayed because the design has not been confirmed yet.",
    explanationZh: "会议表达需要明确主语和时态；has not been confirmed 更专业。",
    betterExpression: "The main blocker is that the design has not been confirmed yet.",
  },
};

export function mockTranscript(referenceText) {
  return referenceText || "I would like to practice this sentence again.";
}

function userTurns(turns) {
  return turns.filter((turn) => turn.speaker === "user" && turn.transcript?.trim());
}

export function createMockSummary({ sessionId, scenario, turns }) {
  const spokenTurns = userTurns(turns);
  const fallbackCorrection = correctionExamples[scenario.id] || correctionExamples.job_interview;
  const userEvidence = spokenTurns[0]?.transcript || fallbackCorrection.original;
  const correction = buildCorrection({
    scenario,
    userEvidence,
    fallback: fallbackCorrection,
  });
  const turnCount = spokenTurns.length;
  const completionScore = Math.min(88, 62 + turnCount * 7);

  return {
    sessionId,
    source: "mock",
    overallScore: completionScore,
    scores: {
      pronunciation: Math.min(84, 68 + turnCount * 3),
      fluency: Math.min(86, 66 + turnCount * 4),
      grammar: Math.min(85, 70 + turnCount * 3),
      vocabulary: Math.min(82, 67 + turnCount * 3),
      interaction: Math.min(90, 72 + turnCount * 4),
    },
    goalCompletion: scenario.goals.map((goal, index) => {
      if (index < Math.max(1, turnCount)) return `Covered: ${goal}`;
      return `Needs more practice: ${goal}`;
    }),
    corrections: [correction],
    betterExpressions: [
      correction.betterExpression,
      scenario.id === "job_interview"
        ? "One project I am proud of involved improving onboarding conversion."
        : scenario.id === "restaurant_ordering"
          ? "Could you make that iced and to go?"
          : "I suggest we confirm the owner and deadline before we close.",
      "Let me clarify what I mean.",
    ],
    pronunciationFocus: scenario.id === "restaurant_ordering"
      ? "Practice polite sentence endings and the vowel in oat."
      : scenario.id === "business_meeting"
        ? "Practice sentence stress on blocker, timeline, and next steps."
        : "Practice stress in longer interview answers and avoid rushing function words.",
    practiceTasks: [
      `Repeat: "${scenario.pronunciationSentences[0]}"`,
      "Record a shorter answer using one clear structure.",
      "Replace one simple phrase with a more natural expression from the report.",
    ],
    recommendedPronunciationText: scenario.pronunciationSentences[0],
  };
}

function buildCorrection({ scenario, userEvidence, fallback }) {
  if (!userEvidence || userEvidence.length < 8) return fallback;

  if (/i am work/i.test(userEvidence)) {
    return {
      type: "grammar",
      severity: "medium",
      original: userEvidence,
      corrected: userEvidence
        .replace(/i am work/i, "I have worked")
        .replace(/as product manager/i, "as a product manager"),
      explanationZh: "表达过去持续到现在的经历，用 have worked；职位前通常需要冠词。",
      betterExpression: "I've spent the last three years working as a product manager.",
    };
  }

  if (/coffee|latte|milk|want|get/i.test(userEvidence)) {
    return {
      type: "expression",
      severity: scenario.id === "restaurant_ordering" ? "low" : "medium",
      original: userEvidence,
      corrected: "Could I get a medium latte with oat milk, please?",
      explanationZh: "请求类表达用 Could I get... 更自然，please 能让语气更礼貌。",
      betterExpression: "Could I get that to go, please?",
    };
  }

  if (/delay|blocker|timeline|meeting/i.test(userEvidence)) {
    return {
      type: "expression",
      severity: "medium",
      original: userEvidence,
      corrected: "The main blocker is that the timeline has not been confirmed yet.",
      explanationZh: "会议表达要明确 blocker 和原因，句子结构越清楚越专业。",
      betterExpression: "The main blocker is alignment on the revised timeline.",
    };
  }

  return {
    ...fallback,
    original: userEvidence,
    corrected: userEvidence,
    explanationZh: "这句话整体可以理解。下一步可以用更完整的结构表达原因、结果或请求。",
  };
}

export function createMockPronunciationAssessment({ referenceText, scenarioId }) {
  const text = referenceText || "Could I get a medium latte with oat milk, please?";
  const words = text
    .replace(/[^\w\s']/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const weakWords = words
    .filter((word) => word.length > 3)
    .slice(0, 3)
    .map((word, index) => ({
      word,
      score: 68 + index * 5,
      tipZh: index === 0
        ? "注意这个词的重音位置。"
        : index === 1
          ? "把元音读完整，不要吞音。"
          : "放慢一点，保持句子节奏。",
    }));

  return {
    scenarioId,
    source: "mock",
    pronunciation: 78,
    accuracy: 75,
    fluency: 82,
    completeness: 94,
    prosody: 72,
    weakWords,
    adviceZh: "整体可理解，下一步重点练习重音、长元音和句尾语调。",
  };
}
