const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "overallScore",
    "scores",
    "goalCompletion",
    "corrections",
    "betterExpressions",
    "pronunciationFocus",
    "practiceTasks",
    "recommendedPronunciationText",
  ],
  properties: {
    overallScore: { type: "number" },
    scores: {
      type: "object",
      additionalProperties: false,
      required: ["pronunciation", "fluency", "grammar", "vocabulary", "interaction"],
      properties: {
        pronunciation: { type: "number" },
        fluency: { type: "number" },
        grammar: { type: "number" },
        vocabulary: { type: "number" },
        interaction: { type: "number" },
      },
    },
    goalCompletion: {
      type: "array",
      items: { type: "string" },
    },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "severity", "original", "corrected", "explanationZh", "betterExpression"],
        properties: {
          type: { type: "string", enum: ["grammar", "vocabulary", "expression", "pragmatics"] },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          original: { type: "string" },
          corrected: { type: "string" },
          explanationZh: { type: "string" },
          betterExpression: { type: "string" },
        },
      },
    },
    betterExpressions: {
      type: "array",
      items: { type: "string" },
    },
    pronunciationFocus: { type: "string" },
    practiceTasks: {
      type: "array",
      items: { type: "string" },
    },
    recommendedPronunciationText: { type: "string" },
  },
};

export async function createSummary({
  sessionId,
  scenario,
  level,
  turns,
  env = process.env,
  fetchImpl = fetch,
}) {
  const userTurns = turns.filter((turn) => turn.speaker === "user" && turn.transcript?.trim());

  if (!userTurns.length) {
    throw new Error("No user turns available for summary");
  }

  if (env.DEEPSEEK_API_KEY) {
    return createDeepSeekSummary({
      sessionId,
      scenario,
      level,
      turns,
      env,
      fetchImpl,
    });
  }

  return createOpenAISummary({
    sessionId,
    scenario,
    level,
    turns,
    env,
    fetchImpl,
  });
}

export async function createOpenAISummary({
  sessionId,
  scenario,
  level,
  turns,
  env = process.env,
  fetchImpl = fetch,
}) {
  const model = env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";

  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are an English speaking coach for Chinese learners.",
                "Analyze only learner/user turns.",
                "Return practical, encouraging feedback.",
                "Every correction must quote the learner's original sentence.",
                "Do not claim an official CEFR score.",
                "Keep Chinese explanations short and actionable.",
                "Pick at most three high-value corrections.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                scenario: {
                  id: scenario.id,
                  title: scenario.title,
                  aiRole: scenario.aiRole,
                  userRole: scenario.userRole,
                  goals: scenario.goals,
                  keywords: scenario.keywords,
                  pronunciationSentences: scenario.pronunciationSentences,
                },
                level: level || scenario.level,
                turns: turns.map((turn) => ({
                  speaker: turn.speaker,
                  sequence: turn.sequence,
                  transcript: turn.transcript,
                })),
              }, null, 2),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "session_summary",
          strict: true,
          schema: SUMMARY_SCHEMA,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI summary failed with ${response.status}`);
  }

  const text = extractOutputText(payload);
  const summary = normalizeSummary(JSON.parse(text), scenario);

  return {
    sessionId,
    source: "openai_responses",
    model,
    ...summary,
  };
}

async function createDeepSeekSummary({
  sessionId,
  scenario,
  level,
  turns,
  env,
  fetchImpl,
}) {
  const model = env.DEEPSEEK_TEXT_MODEL || "deepseek-v4-pro";
  const baseUrl = (env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");

  const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            "You are an English speaking coach for Chinese learners.",
            "Analyze only learner/user turns.",
            "Return valid JSON only.",
            "Every correction must quote the learner's original sentence.",
            "Do not claim an official CEFR score.",
            "Keep Chinese explanations short and actionable.",
            "Pick at most three high-value corrections.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            scenario: {
              id: scenario.id,
              title: scenario.title,
              aiRole: scenario.aiRole,
              userRole: scenario.userRole,
              goals: scenario.goals,
              keywords: scenario.keywords,
              pronunciationSentences: scenario.pronunciationSentences,
            },
            level: level || scenario.level,
            turns: turns.map((turn) => ({
              speaker: turn.speaker,
              sequence: turn.sequence,
              transcript: turn.transcript,
            })),
            expectedJsonShape: {
              overallScore: 78,
              scores: {
                pronunciation: 72,
                fluency: 76,
                grammar: 80,
                vocabulary: 74,
                interaction: 82,
              },
              goalCompletion: ["Completed a short self-introduction"],
              corrections: [{
                type: "grammar",
                severity: "medium",
                original: "learner original sentence",
                corrected: "corrected sentence",
                explanationZh: "中文解释",
                betterExpression: "more natural expression",
              }],
              betterExpressions: ["more natural expression"],
              pronunciationFocus: "one focused pronunciation suggestion",
              practiceTasks: ["one concrete practice task"],
              recommendedPronunciationText: scenario.pronunciationSentences[0],
            },
          }, null, 2),
        },
      ],
      response_format: {
        type: "json_object",
      },
      max_tokens: 4000,
      temperature: 0.2,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `DeepSeek summary failed with ${response.status}`);
  }

  const text = extractDeepSeekOutputText(payload);
  const summary = normalizeSummary(JSON.parse(text), scenario);

  return {
    sessionId,
    source: "deepseek_v4",
    model,
    ...summary,
  };
}

function extractDeepSeekOutputText(payload) {
  const content = payload.choices?.[0]?.message?.content;
  if (content) return content;
  throw new Error("DeepSeek response did not include message content");
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
      if (content.type === "text" && content.text) return content.text;
    }
  }

  throw new Error("OpenAI response did not include output text");
}

function normalizeSummary(summary, scenario) {
  const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  const text = (value, fallback = "") => String(value || fallback).trim();

  return {
    overallScore: clamp(summary.overallScore),
    scores: {
      pronunciation: clamp(summary.scores?.pronunciation),
      fluency: clamp(summary.scores?.fluency),
      grammar: clamp(summary.scores?.grammar),
      vocabulary: clamp(summary.scores?.vocabulary),
      interaction: clamp(summary.scores?.interaction),
    },
    goalCompletion: ensureArray(summary.goalCompletion, scenario.goals),
    corrections: ensureArray(summary.corrections, []).slice(0, 3).map((item) => ({
      type: ["grammar", "vocabulary", "expression", "pragmatics"].includes(item.type) ? item.type : "expression",
      severity: ["low", "medium", "high"].includes(item.severity) ? item.severity : "medium",
      original: text(item.original, "Learner sentence was unclear."),
      corrected: text(item.corrected, item.original),
      explanationZh: text(item.explanationZh, "这句话可以更自然。"),
      betterExpression: text(item.betterExpression, item.corrected),
    })),
    betterExpressions: ensureArray(summary.betterExpressions, []).slice(0, 5),
    pronunciationFocus: text(summary.pronunciationFocus, "Practice sentence stress and clear endings."),
    practiceTasks: ensureArray(summary.practiceTasks, []).slice(0, 5),
    recommendedPronunciationText: text(
      summary.recommendedPronunciationText,
      scenario.pronunciationSentences[0],
    ),
  };
}

function ensureArray(value, fallback) {
  if (Array.isArray(value) && value.length) return value.map((item) => {
    if (typeof item === "string") return item;
    return item && typeof item === "object" ? item : String(item);
  });
  return fallback;
}
