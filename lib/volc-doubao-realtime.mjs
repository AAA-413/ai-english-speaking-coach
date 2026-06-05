import {
  canGenerateVolcRtcClientToken,
  createVolcRtcClientToken,
  validateVolcRtcClientTokenConfig,
} from "./volc-rtc-token.mjs";
import {
  callVolcRtcOpenApi,
  DEFAULT_VOLC_RTC_OPENAPI_VERSION,
  missingVolcOpenApiFields,
  volcOpenApiHealth,
} from "./volc-openapi.mjs";

const DEFAULT_MODEL = "1.2.1.1";
export const DEFAULT_VOLC_RTC_WEB_SDK_VERSION = "4.68.4";
export const DEFAULT_VOLC_RTC_WEB_SDK_URL =
  "https://lf-unpkg.volccdn.com/obj/vcloudfe/sdk/@volcengine/rtc/4.68.4/1778142355039/index.min.js";

export function createVolcDoubaoRealtimeSession({
  scenario,
  level,
  correctionMode,
  sessionId,
  env = process.env,
}) {
  const model = env.VOLC_DOUBAO_MODEL || DEFAULT_MODEL;
  const ids = createVolcDoubaoIds({ sessionId, env });
  const instructions = buildVolcDoubaoInstructions({ scenario, level, correctionMode });
  const missing = requiredVolcDoubaoFields(env);
  const clientToken = createClientToken({ env, roomId: ids.roomId, userId: ids.userId });
  const sdkUrl = resolveVolcRtcWebSdkUrl(env);

  if (missing.length) {
    throw new Error(`Volc Doubao realtime is missing ${missing.join(", ")}`);
  }

  return {
    provider: "volc_doubao",
    model,
    roomId: ids.roomId,
    taskId: ids.taskId,
    userId: ids.userId,
    agentUserId: ids.agentUserId,
    rtcAppId: env.VOLC_RTC_APP_ID,
    clientToken,
    sdkUrl,
    sdkSource: env.VOLC_RTC_WEB_SDK_URL ? "custom_url" : "official_cdn",
    sdkVersion: DEFAULT_VOLC_RTC_WEB_SDK_VERSION,
    s2sAppId: env.VOLC_DOUBAO_S2S_APP_ID,
    startVoiceChatPayload: {
      AppId: env.VOLC_RTC_APP_ID,
      RoomId: ids.roomId,
      TaskId: ids.taskId,
      BusinessId: env.VOLC_RTC_BUSINESS_ID || "ai_english_speaking_coach",
      Config: {
        S2SConfig: {
          Provider: "volcano",
          OutputMode: 0,
          ProviderParams: {
            app: {
              appid: env.VOLC_DOUBAO_S2S_APP_ID,
              token: env.VOLC_DOUBAO_S2S_TOKEN,
            },
            dialog: {
              bot_name: env.VOLC_DOUBAO_BOT_NAME || "English Coach",
              system_role: instructions,
              speaking_style: "Natural, concise, friendly, one question at a time.",
              extra: {
                model,
              },
            },
          },
        },
        SubtitleConfig: {
          SubtitleMode: 1,
        },
      },
      AgentConfig: {
        UserId: ids.agentUserId,
        TargetUserId: [ids.userId],
        UserName: "English Coach",
        WelcomeMessage: scenario.openingPrompt,
      },
    },
  };
}

export function createVolcDoubaoIds({ sessionId, env = process.env }) {
  const roomPrefix = env.VOLC_RTC_ROOM_ID_PREFIX || "english_coach";
  return {
    roomId: sanitizeVolcRtcId(`${roomPrefix}_${sessionId}`),
    taskId: sanitizeVolcRtcId(`task_${sessionId}`),
    userId: sanitizeVolcRtcId(`learner_${sessionId}`),
    agentUserId: sanitizeVolcRtcId(`coach_${sessionId}`),
  };
}

export async function startVolcDoubaoVoiceChat({
  session,
  env = process.env,
  fetchImpl = globalThis.fetch,
}) {
  if (env.VOLC_RTC_START_VOICE_CHAT_ENABLED === "false") {
    return {
      ok: false,
      status: "disabled",
      message: "VOLC_RTC_START_VOICE_CHAT_ENABLED=false",
    };
  }

  const missing = requiredVolcDoubaoServerFields(env);
  if (missing.length) {
    return {
      ok: false,
      status: "skipped",
      missing,
      message: `Volc OpenAPI is missing ${missing.join(", ")}`,
    };
  }

  try {
    const result = await callVolcRtcOpenApi({
      action: "StartVoiceChat",
      payload: session.startVoiceChatPayload,
      env,
      fetchImpl,
    });
    return {
      ok: true,
      status: "started",
      action: result.action,
      version: result.version,
      requestId: result.requestId,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error.message || "StartVoiceChat failed",
    };
  }
}

export async function stopVolcDoubaoVoiceChat({
  roomId,
  taskId,
  env = process.env,
  fetchImpl = globalThis.fetch,
}) {
  if (env.VOLC_RTC_START_VOICE_CHAT_ENABLED === "false") {
    return {
      ok: false,
      status: "disabled",
      message: "VOLC_RTC_START_VOICE_CHAT_ENABLED=false",
    };
  }

  const missing = requiredVolcDoubaoServerFields(env);
  if (missing.length) {
    return {
      ok: false,
      status: "skipped",
      missing,
      message: `Volc OpenAPI is missing ${missing.join(", ")}`,
    };
  }
  if (!roomId || !taskId) {
    return {
      ok: false,
      status: "skipped",
      message: "StopVoiceChat requires roomId and taskId",
    };
  }

  try {
    const result = await callVolcRtcOpenApi({
      action: "StopVoiceChat",
      payload: {
        AppId: env.VOLC_RTC_APP_ID,
        RoomId: roomId,
        TaskId: taskId,
      },
      env,
      fetchImpl,
    });
    return {
      ok: true,
      status: "stopped",
      action: result.action,
      version: result.version,
      requestId: result.requestId,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error.message || "StopVoiceChat failed",
    };
  }
}

export function volcDoubaoHealth(env = process.env) {
  const missing = requiredVolcDoubaoFields(env);
  const clientMissing = requiredVolcDoubaoClientFields(env);
  const serverMissing = requiredVolcDoubaoServerFields(env);
  const tokenConfigInvalid = validateVolcRtcClientTokenConfig(env);
  const canGenerateClientToken = canGenerateVolcRtcClientToken(env);
  const sdkUrl = resolveVolcRtcWebSdkUrl(env);
  return {
    provider: "volc_doubao",
    model: env.VOLC_DOUBAO_MODEL || DEFAULT_MODEL,
    hasRtcAppId: Boolean(env.VOLC_RTC_APP_ID),
    hasRtcAppKey: Boolean(env.VOLC_RTC_APP_KEY),
    hasRtcClientToken: Boolean(env.VOLC_RTC_CLIENT_TOKEN),
    hasRtcWebSdkUrl: Boolean(sdkUrl),
    usesDefaultRtcWebSdk: !env.VOLC_RTC_WEB_SDK_URL,
    rtcWebSdkVersion: DEFAULT_VOLC_RTC_WEB_SDK_VERSION,
    openApiVersion: env.VOLC_RTC_OPENAPI_VERSION || DEFAULT_VOLC_RTC_OPENAPI_VERSION,
    hasS2sAppId: Boolean(env.VOLC_DOUBAO_S2S_APP_ID),
    hasS2sToken: Boolean(env.VOLC_DOUBAO_S2S_TOKEN),
    ready: missing.length === 0,
    canGenerateClientToken,
    clientReady: missing.length === 0 && clientMissing.length === 0,
    serverReady: missing.length === 0 && serverMissing.length === 0,
    missing,
    clientMissing,
    serverMissing,
    tokenConfigInvalid,
    openApi: volcOpenApiHealth(env),
  };
}

function requiredVolcDoubaoFields(env) {
  const fields = [];
  if (!env.VOLC_RTC_APP_ID) fields.push("VOLC_RTC_APP_ID");
  if (!env.VOLC_DOUBAO_S2S_APP_ID) fields.push("VOLC_DOUBAO_S2S_APP_ID");
  if (!env.VOLC_DOUBAO_S2S_TOKEN) fields.push("VOLC_DOUBAO_S2S_TOKEN");
  return fields;
}

function requiredVolcDoubaoClientFields(env) {
  const fields = [];
  if (!env.VOLC_RTC_CLIENT_TOKEN && !canGenerateVolcRtcClientToken(env)) {
    fields.push("VOLC_RTC_CLIENT_TOKEN or valid VOLC_RTC_APP_KEY");
  }
  return fields;
}

function requiredVolcDoubaoServerFields(env) {
  return missingVolcOpenApiFields(env);
}

function createClientToken({ env, roomId, userId }) {
  if (env.VOLC_RTC_CLIENT_TOKEN) return env.VOLC_RTC_CLIENT_TOKEN;
  if (!canGenerateVolcRtcClientToken(env)) return "";
  return createVolcRtcClientToken({
    appId: env.VOLC_RTC_APP_ID,
    appKey: env.VOLC_RTC_APP_KEY,
    roomId,
    userId,
    ttlSeconds: Number(env.VOLC_RTC_TOKEN_TTL_SECONDS || 24 * 60 * 60),
  });
}

function resolveVolcRtcWebSdkUrl(env) {
  return env.VOLC_RTC_WEB_SDK_URL || DEFAULT_VOLC_RTC_WEB_SDK_URL;
}

function sanitizeVolcRtcId(value) {
  return String(value).replace(/[^a-zA-Z0-9_@.-]/g, "_").slice(0, 64);
}

function buildVolcDoubaoInstructions({ scenario, level, correctionMode }) {
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
