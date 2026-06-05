const DEFAULT_MODEL = "1.2.1.1";

export function createVolcDoubaoRealtimeSession({
  scenario,
  level,
  correctionMode,
  sessionId,
  env = process.env,
}) {
  const model = env.VOLC_DOUBAO_MODEL || DEFAULT_MODEL;
  const roomId = env.VOLC_RTC_ROOM_ID_PREFIX
    ? `${env.VOLC_RTC_ROOM_ID_PREFIX}_${sessionId}`
    : `english_coach_${sessionId}`;
  const userId = `learner_${sessionId}`.replace(/[^a-zA-Z0-9_@.-]/g, "_").slice(0, 64);
  const agentUserId = `coach_${sessionId}`.replace(/[^a-zA-Z0-9_@.-]/g, "_").slice(0, 64);
  const instructions = buildVolcDoubaoInstructions({ scenario, level, correctionMode });
  const missing = requiredVolcDoubaoFields(env);

  if (missing.length) {
    throw new Error(`Volc Doubao realtime is missing ${missing.join(", ")}`);
  }

  return {
    provider: "volc_doubao",
    model,
    roomId,
    userId,
    agentUserId,
    rtcAppId: env.VOLC_RTC_APP_ID,
    clientToken: env.VOLC_RTC_CLIENT_TOKEN || "",
    sdkUrl: env.VOLC_RTC_WEB_SDK_URL || "",
    s2sAppId: env.VOLC_DOUBAO_S2S_APP_ID,
    startVoiceChatPayload: {
      RoomId: roomId,
      TaskId: `task_${sessionId}`.slice(0, 64),
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
        UserId: agentUserId,
        UserName: "English Coach",
      },
    },
  };
}

export function volcDoubaoHealth(env = process.env) {
  const missing = requiredVolcDoubaoFields(env);
  const clientMissing = requiredVolcDoubaoClientFields(env);
  return {
    provider: "volc_doubao",
    model: env.VOLC_DOUBAO_MODEL || DEFAULT_MODEL,
    hasRtcAppId: Boolean(env.VOLC_RTC_APP_ID),
    hasRtcClientToken: Boolean(env.VOLC_RTC_CLIENT_TOKEN),
    hasRtcWebSdkUrl: Boolean(env.VOLC_RTC_WEB_SDK_URL),
    hasS2sAppId: Boolean(env.VOLC_DOUBAO_S2S_APP_ID),
    hasS2sToken: Boolean(env.VOLC_DOUBAO_S2S_TOKEN),
    ready: missing.length === 0,
    clientReady: missing.length === 0 && clientMissing.length === 0,
    missing,
    clientMissing,
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
  if (!env.VOLC_RTC_CLIENT_TOKEN) fields.push("VOLC_RTC_CLIENT_TOKEN");
  return fields;
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
