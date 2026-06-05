import type {
  CorrectionMode,
  EnglishLevel,
  HealthResponse,
  RealtimeProvider,
  RealtimeSessionResponse,
  Scenario,
  VolcDoubaoHealth,
} from "@/shared/practice";
import { loadRealtimeProvider, shouldUseMockAnalysis } from "./env";

const VOLC_DEFAULT_MODEL = "1.2.1.1";

export function createSessionId() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createHealthResponse(): HealthResponse {
  return {
    ok: true,
    demoMode: process.env.DEMO_MODE === "true",
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    realtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2",
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    textModel: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
    deepSeekTextModel: process.env.DEEPSEEK_TEXT_MODEL || "deepseek-v4-pro",
    realtimeProvider: loadRealtimeProvider(),
    realtimeVoice: process.env.OPENAI_REALTIME_VOICE || "marin",
    useMockAnalysis: shouldUseMockAnalysis(),
    hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY),
    hasAzureSpeech: Boolean(
      process.env.AZURE_SPEECH_KEY
      && (process.env.AZURE_SPEECH_ENDPOINT || process.env.AZURE_SPEECH_REGION),
    ),
    volcDoubao: volcDoubaoHealth(),
  };
}

export async function createRealtimeSession({
  scenario,
  sessionId,
  provider,
  level,
  correctionMode,
  voice,
}: {
  scenario: Scenario;
  sessionId: string;
  provider: RealtimeProvider;
  level?: EnglishLevel;
  correctionMode?: CorrectionMode;
  voice?: string;
}): Promise<RealtimeSessionResponse> {
  if (provider === "mock") {
    return {
      mode: "mock",
      provider,
      sessionId,
      reason: "Mock realtime provider selected",
      scenario,
    };
  }

  if (provider === "volc_doubao") {
    if (process.env.DEMO_MODE === "true") {
      return { mode: "mock", provider, sessionId, reason: "DEMO_MODE enabled", scenario };
    }

    try {
      const volcSession = createVolcDoubaoRealtimeSession({
        scenario,
        level,
        correctionMode,
        sessionId,
      });
      return {
        mode: "volc_doubao_setup",
        provider,
        sessionId,
        reason: "Volc Doubao O2.0 config is ready; frontend RTC SDK connection is the next integration step.",
        scenario,
        model: volcSession.model,
        rtcAppId: volcSession.rtcAppId,
        clientToken: volcSession.clientToken,
        sdkUrl: volcSession.sdkUrl,
        roomId: volcSession.roomId,
        userId: volcSession.userId,
        agentUserId: volcSession.agentUserId,
        serverStartRequired: true,
        clientJoinReady: Boolean(volcSession.clientToken),
        s2sConfigPreview: redactVolcDoubaoPayload(volcSession.startVoiceChatPayload),
      };
    } catch (error) {
      return {
        mode: "mock",
        provider,
        sessionId,
        reason: error instanceof Error ? error.message : "Volc Doubao realtime config is incomplete",
        scenario,
      };
    }
  }

  if (process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY) {
    return {
      mode: "mock",
      provider,
      sessionId,
      reason: process.env.OPENAI_API_KEY ? "DEMO_MODE enabled" : "OPENAI_API_KEY is not configured",
      scenario,
    };
  }

  try {
    const result = await createOpenAIRealtimeClientSecret({
      scenario,
      level,
      correctionMode,
      voice: voice || process.env.OPENAI_REALTIME_VOICE || "marin",
      sessionId,
    });
    return {
      mode: "realtime",
      provider,
      sessionId,
      model: result.model,
      clientSecret: result.clientSecret,
      expiresAt: result.expiresAt,
      scenario,
    };
  } catch (error) {
    return {
      mode: "mock",
      provider,
      sessionId,
      reason: error instanceof Error ? error.message : "Realtime session creation failed",
      scenario,
    };
  }
}

async function createOpenAIRealtimeClientSecret({
  scenario,
  level,
  correctionMode,
  voice,
  sessionId,
}: {
  scenario: Scenario;
  level?: EnglishLevel;
  correctionMode?: CorrectionMode;
  voice: string;
  sessionId: string;
}) {
  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
  const transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const sessionConfig = {
    type: "realtime",
    model,
    instructions: buildRealtimeInstructions({ scenario, level, correctionMode }),
    audio: {
      input: {
        transcription: {
          model: transcribeModel,
          language: "en",
          prompt: `English speaking practice about ${scenario.title}. Expect learner mistakes and scenario vocabulary: ${scenario.keywords.join(", ")}.`,
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: scenario.id === "restaurant_ordering" ? 450 : 700,
        },
      },
      output: { voice },
    },
    max_output_tokens: 400,
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `demo-${sessionId}`,
    },
    body: JSON.stringify(sessionConfig),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI Realtime returned ${response.status}`);
  }
  const clientSecret = data.value || data.client_secret?.value;
  if (!clientSecret) throw new Error("OpenAI Realtime response did not include a client secret");
  return { model, clientSecret, expiresAt: data.expires_at || data.client_secret?.expires_at || null };
}

export function createVolcDoubaoRealtimeSession({
  scenario,
  level,
  correctionMode,
  sessionId,
}: {
  scenario: Scenario;
  level?: EnglishLevel;
  correctionMode?: CorrectionMode;
  sessionId: string;
}) {
  const model = process.env.VOLC_DOUBAO_MODEL || VOLC_DEFAULT_MODEL;
  const roomId = process.env.VOLC_RTC_ROOM_ID_PREFIX
    ? `${process.env.VOLC_RTC_ROOM_ID_PREFIX}_${sessionId}`
    : `english_coach_${sessionId}`;
  const userId = `learner_${sessionId}`.replace(/[^a-zA-Z0-9_@.-]/g, "_").slice(0, 64);
  const agentUserId = `coach_${sessionId}`.replace(/[^a-zA-Z0-9_@.-]/g, "_").slice(0, 64);
  const instructions = buildVolcDoubaoInstructions({ scenario, level, correctionMode });
  const missing = requiredVolcDoubaoFields();
  if (missing.length) throw new Error(`Volc Doubao realtime is missing ${missing.join(", ")}`);

  return {
    provider: "volc_doubao",
    model,
    roomId,
    userId,
    agentUserId,
    rtcAppId: process.env.VOLC_RTC_APP_ID || "",
    clientToken: process.env.VOLC_RTC_CLIENT_TOKEN || "",
    sdkUrl: process.env.VOLC_RTC_WEB_SDK_URL || "",
    startVoiceChatPayload: {
      RoomId: roomId,
      TaskId: `task_${sessionId}`.slice(0, 64),
      BusinessId: process.env.VOLC_RTC_BUSINESS_ID || "ai_english_speaking_coach",
      Config: {
        S2SConfig: {
          Provider: "volcano",
          OutputMode: 0,
          ProviderParams: {
            app: {
              appid: process.env.VOLC_DOUBAO_S2S_APP_ID || "",
              token: process.env.VOLC_DOUBAO_S2S_TOKEN || "",
            },
            dialog: {
              bot_name: process.env.VOLC_DOUBAO_BOT_NAME || "English Coach",
              system_role: instructions,
              speaking_style: "Natural, concise, friendly, one question at a time.",
              extra: { model },
            },
          },
        },
        SubtitleConfig: { SubtitleMode: 1 },
      },
      AgentConfig: {
        UserId: agentUserId,
        UserName: "English Coach",
      },
    },
  };
}

export function volcDoubaoHealth(): VolcDoubaoHealth {
  const missing = requiredVolcDoubaoFields();
  const clientMissing = requiredVolcDoubaoClientFields();
  return {
    provider: "volc_doubao",
    model: process.env.VOLC_DOUBAO_MODEL || VOLC_DEFAULT_MODEL,
    hasRtcAppId: Boolean(process.env.VOLC_RTC_APP_ID),
    hasRtcClientToken: Boolean(process.env.VOLC_RTC_CLIENT_TOKEN),
    hasRtcWebSdkUrl: Boolean(process.env.VOLC_RTC_WEB_SDK_URL),
    hasS2sAppId: Boolean(process.env.VOLC_DOUBAO_S2S_APP_ID),
    hasS2sToken: Boolean(process.env.VOLC_DOUBAO_S2S_TOKEN),
    ready: missing.length === 0,
    clientReady: missing.length === 0 && clientMissing.length === 0,
    missing,
    clientMissing,
  };
}

function requiredVolcDoubaoFields() {
  const fields: string[] = [];
  if (!process.env.VOLC_RTC_APP_ID) fields.push("VOLC_RTC_APP_ID");
  if (!process.env.VOLC_DOUBAO_S2S_APP_ID) fields.push("VOLC_DOUBAO_S2S_APP_ID");
  if (!process.env.VOLC_DOUBAO_S2S_TOKEN) fields.push("VOLC_DOUBAO_S2S_TOKEN");
  return fields;
}

function requiredVolcDoubaoClientFields() {
  const fields: string[] = [];
  if (!process.env.VOLC_RTC_CLIENT_TOKEN) fields.push("VOLC_RTC_CLIENT_TOKEN");
  return fields;
}

function buildRealtimeInstructions({
  scenario,
  level,
  correctionMode,
}: {
  scenario: Scenario;
  level?: EnglishLevel;
  correctionMode?: CorrectionMode;
}) {
  const correctionPolicy = {
    immersive: "Do not correct during the conversation unless the learner cannot be understood.",
    coach: "Every 2-3 user turns, give one short correction before continuing the role-play.",
    post_session: "Do not interrupt with corrections. Save feedback for the post-session report.",
  }[correctionMode || "post_session"];

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

function buildVolcDoubaoInstructions({
  scenario,
  level,
  correctionMode,
}: {
  scenario: Scenario;
  level?: EnglishLevel;
  correctionMode?: CorrectionMode;
}) {
  return [
    "你是一个英语口语教练，目标是帮助中文母语用户在真实场景中练习英语。",
    `当前场景：${scenario.title}。`,
    `AI 角色：${scenario.aiRole}。用户角色：${scenario.userRole}。`,
    `用户水平：${level || scenario.level}。纠错模式：${correctionMode || "post_session"}。`,
    "请保持角色扮演，不要长篇教学。",
    "每次回复最多 1-2 句，只问一个问题。",
    "用户卡住时可以给一个短提示或改写问题。",
    "实时对话中不要频繁打断纠错，主要帮助用户继续开口。",
    `练习目标：${scenario.goals.join("；")}。`,
    `关键词：${scenario.keywords.join(", ")}。`,
    `开场白：${scenario.openingPrompt}`,
  ].join("\n");
}

function redactVolcDoubaoPayload(payload: Record<string, any>) {
  return {
    ...payload,
    Config: {
      ...payload.Config,
      S2SConfig: {
        ...payload.Config.S2SConfig,
        ProviderParams: {
          ...payload.Config.S2SConfig.ProviderParams,
          app: {
            ...payload.Config.S2SConfig.ProviderParams.app,
            token: payload.Config.S2SConfig.ProviderParams.app.token ? "[redacted]" : "",
          },
        },
      },
    },
  };
}
