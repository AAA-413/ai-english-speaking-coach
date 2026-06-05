import type { Correction, PracticeTurn, Scenario, SessionSummary, TranscriptionResult } from "@/shared/practice";

const summarySchema = {
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
    goalCompletion: { type: "array", items: { type: "string" } },
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
    betterExpressions: { type: "array", items: { type: "string" } },
    pronunciationFocus: { type: "string" },
    practiceTasks: { type: "array", items: { type: "string" } },
    recommendedPronunciationText: { type: "string" },
  },
};

const correctionExamples: Record<string, Correction> = {
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

export function mockTranscript(referenceText?: string) {
  return referenceText || "I would like to practice this sentence again.";
}

export function createMockSummary({
  sessionId,
  scenario,
  turns,
}: {
  sessionId: string;
  scenario: Scenario;
  turns: PracticeTurn[];
}): SessionSummary {
  const spokenTurns = turns.filter((turn) => turn.speaker === "user" && turn.transcript?.trim());
  const fallbackCorrection = correctionExamples[scenario.id] || correctionExamples.job_interview;
  const userEvidence = spokenTurns[0]?.transcript || fallbackCorrection.original;
  const correction = buildCorrection({ scenario, userEvidence, fallback: fallbackCorrection });
  const turnCount = spokenTurns.length;
  const completionScore = Math.min(88, 62 + turnCount * 7);

  return {
    sessionId,
    scenarioId: scenario.id,
    source: "mock",
    overallScore: completionScore,
    scores: {
      pronunciation: Math.min(84, 68 + turnCount * 3),
      fluency: Math.min(86, 66 + turnCount * 4),
      grammar: Math.min(85, 70 + turnCount * 3),
      vocabulary: Math.min(82, 67 + turnCount * 3),
      interaction: Math.min(90, 72 + turnCount * 4),
    },
    goalCompletion: scenario.goals.map((goal, index) => (
      index < Math.max(1, turnCount) ? `Covered: ${goal}` : `Needs more practice: ${goal}`
    )),
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
    generatedAt: new Date().toISOString(),
  };
}

function buildCorrection({
  scenario,
  userEvidence,
  fallback,
}: {
  scenario: Scenario;
  userEvidence: string;
  fallback: Correction;
}): Correction {
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

export async function createSummary({
  sessionId,
  scenario,
  level,
  turns,
  fetchImpl = fetch,
}: {
  sessionId: string;
  scenario: Scenario;
  level?: string;
  turns: PracticeTurn[];
  fetchImpl?: typeof fetch;
}): Promise<SessionSummary> {
  const userTurns = turns.filter((turn) => turn.speaker === "user" && turn.transcript?.trim());
  if (!userTurns.length) throw new Error("No user turns available for summary");

  if (process.env.DEEPSEEK_API_KEY) {
    return createDeepSeekSummary({ sessionId, scenario, level, turns, fetchImpl });
  }

  return createOpenAISummary({ sessionId, scenario, level, turns, fetchImpl });
}

async function createOpenAISummary({
  sessionId,
  scenario,
  level,
  turns,
  fetchImpl,
}: {
  sessionId: string;
  scenario: Scenario;
  level?: string;
  turns: PracticeTurn[];
  fetchImpl: typeof fetch;
}): Promise<SessionSummary> {
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildSummaryInput({ scenario, level, turns }),
      text: {
        format: {
          type: "json_schema",
          name: "session_summary",
          strict: true,
          schema: summarySchema,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI summary failed with ${response.status}`);
  const summary = normalizeSummary(JSON.parse(extractOpenAIText(payload)), scenario);
  return { sessionId, scenarioId: scenario.id, source: "openai_responses", model, ...summary };
}

async function createDeepSeekSummary({
  sessionId,
  scenario,
  level,
  turns,
  fetchImpl,
}: {
  sessionId: string;
  scenario: Scenario;
  level?: string;
  turns: PracticeTurn[];
  fetchImpl: typeof fetch;
}): Promise<SessionSummary> {
  const model = process.env.DEEPSEEK_TEXT_MODEL || "deepseek-v4-pro";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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
            scenario: pickScenarioPromptData(scenario),
            level: level || scenario.level,
            turns: turns.map(pickTurnPromptData),
            expectedJsonShape: {
              overallScore: 78,
              scores: { pronunciation: 72, fluency: 76, grammar: 80, vocabulary: 74, interaction: 82 },
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
      response_format: { type: "json_object" },
      max_tokens: 4000,
      temperature: 0.2,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `DeepSeek summary failed with ${response.status}`);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek response did not include message content");
  const summary = normalizeSummary(JSON.parse(content), scenario);
  return { sessionId, scenarioId: scenario.id, source: "deepseek_v4", model, ...summary };
}

function buildSummaryInput({ scenario, level, turns }: { scenario: Scenario; level?: string; turns: PracticeTurn[] }) {
  return [
    {
      role: "system",
      content: [{
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
      }],
    },
    {
      role: "user",
      content: [{
        type: "input_text",
        text: JSON.stringify({
          scenario: pickScenarioPromptData(scenario),
          level: level || scenario.level,
          turns: turns.map(pickTurnPromptData),
        }, null, 2),
      }],
    },
  ];
}

function pickScenarioPromptData(scenario: Scenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    aiRole: scenario.aiRole,
    userRole: scenario.userRole,
    goals: scenario.goals,
    keywords: scenario.keywords,
    pronunciationSentences: scenario.pronunciationSentences,
  };
}

function pickTurnPromptData(turn: PracticeTurn) {
  return { speaker: turn.speaker, sequence: turn.sequence, transcript: turn.transcript };
}

function extractOpenAIText(payload: Record<string, any>) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if ((content.type === "output_text" || content.type === "text") && content.text) return content.text;
    }
  }
  throw new Error("OpenAI response did not include output text");
}

function normalizeSummary(summary: Record<string, any>, scenario: Scenario) {
  const clamp = (value: unknown) => Math.max(0, Math.min(100, Number(value) || 0));
  const text = (value: unknown, fallback = "") => String(value || fallback).trim();
  return {
    overallScore: clamp(summary.overallScore),
    scores: {
      pronunciation: clamp(summary.scores?.pronunciation),
      fluency: clamp(summary.scores?.fluency),
      grammar: clamp(summary.scores?.grammar),
      vocabulary: clamp(summary.scores?.vocabulary),
      interaction: clamp(summary.scores?.interaction),
    },
    goalCompletion: ensureStringArray(summary.goalCompletion, scenario.goals),
    corrections: ensureArray(summary.corrections, []).slice(0, 3).map((item: Record<string, any>) => ({
      type: ["grammar", "vocabulary", "expression", "pragmatics"].includes(item.type) ? item.type : "expression",
      severity: ["low", "medium", "high"].includes(item.severity) ? item.severity : "medium",
      original: text(item.original, "Learner sentence was unclear."),
      corrected: text(item.corrected, item.original),
      explanationZh: text(item.explanationZh, "这句话可以更自然。"),
      betterExpression: text(item.betterExpression, item.corrected),
    })),
    betterExpressions: ensureStringArray(summary.betterExpressions, []).slice(0, 5),
    pronunciationFocus: text(summary.pronunciationFocus, "Practice sentence stress and clear endings."),
    practiceTasks: ensureStringArray(summary.practiceTasks, []).slice(0, 5),
    recommendedPronunciationText: text(summary.recommendedPronunciationText, scenario.pronunciationSentences[0]),
    generatedAt: new Date().toISOString(),
  };
}

function ensureArray(value: unknown, fallback: unknown[]) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function ensureStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value) && value.length) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
  }
  return fallback;
}

export async function transcribeAudio({
  sessionId,
  turnId,
  audioBase64,
  roughTranscript,
  referenceText,
  mimeType,
  fileName,
  language = "en",
}: {
  sessionId: string;
  turnId: string;
  audioBase64?: string;
  roughTranscript?: string;
  referenceText?: string;
  mimeType?: string;
  fileName?: string;
  language?: string;
}): Promise<TranscriptionResult> {
  if (!audioBase64) {
    return {
      sessionId,
      turnId,
      transcript: roughTranscript || mockTranscript(referenceText),
      confidence: roughTranscript ? 0.86 : 0.72,
      source: roughTranscript ? "rough_transcript" : "mock",
    };
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const bytes = Buffer.from(stripDataUrlPrefix(audioBase64), "base64");
  if (!bytes.length) throw new Error("audioBase64 did not decode to audio bytes");

  const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
  const form = new FormData();
  form.append("model", model);
  form.append("file", blob, fileName || defaultFileName(mimeType));
  form.append("language", language);
  form.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI transcription failed with ${response.status}`);

  return {
    sessionId,
    turnId,
    transcript: payload.text || "",
    confidence: payload.confidence ?? 0.86,
    source: "openai_transcribe",
  };
}

function stripDataUrlPrefix(value: string) {
  return String(value).replace(/^data:[^;]+;base64,/, "");
}

function defaultFileName(mimeType?: string) {
  if (mimeType?.includes("mp4")) return "audio.mp4";
  if (mimeType?.includes("mpeg")) return "audio.mp3";
  if (mimeType?.includes("wav")) return "audio.wav";
  if (mimeType?.includes("ogg")) return "audio.ogg";
  return "audio.webm";
}
