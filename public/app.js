const state = {
  scenarios: [],
  selectedScenarioId: "job_interview",
  level: "B1",
  correctionMode: "post_session",
  realtimeProvider: "browser_voice",
  voice: "marin",
  sessionId: null,
  mode: "idle",
  turns: [],
  peerConnection: null,
  dataChannel: null,
  localStream: null,
  volcRtcEngine: null,
  volcRtcRoom: null,
  remoteAudioActive: false,
  browserVoiceFallback: false,
  browserVoiceRecognition: null,
  browserVoiceBusy: false,
  browserVoiceRecognitionDisabled: false,
  mediaRecorder: null,
  speechRecognition: null,
  pronunciationRecognition: null,
  pronunciationText: "",
  health: null,
  sessionStartedAt: null,
  sessionEndedAt: null,
  sessionMode: "unknown",
  sessionReason: "",
  eventLog: [],
  lastSummary: null,
  pronunciationAudio: null,
  lastPronunciationResult: null,
  lastRealtimeSetup: null,
  generatedAudioUrl: null,
  lastGeneratedAudio: null,
  audioUnlocked: false,
};

const els = {
  scenarioList: document.querySelector("#scenarioList"),
  sessionEyebrow: document.querySelector("#sessionEyebrow"),
  sessionTitle: document.querySelector("#sessionTitle"),
  statusPill: document.querySelector("#statusPill"),
  modeLabel: document.querySelector("#modeLabel"),
  sessionIdLabel: document.querySelector("#sessionIdLabel"),
  turnCountLabel: document.querySelector("#turnCountLabel"),
  exportSessionBtn: document.querySelector("#exportSessionBtn"),
  goalList: document.querySelector("#goalList"),
  keywordList: document.querySelector("#keywordList"),
  startBtn: document.querySelector("#startBtn"),
  endBtn: document.querySelector("#endBtn"),
  correctionMode: document.querySelector("#correctionMode"),
  realtimeProvider: document.querySelector("#realtimeProvider"),
  voiceSelect: document.querySelector("#voiceSelect"),
  transcriptList: document.querySelector("#transcriptList"),
  mockInput: document.querySelector("#mockInput"),
  testVoiceBtn: document.querySelector("#testVoiceBtn"),
  sendMockBtn: document.querySelector("#sendMockBtn"),
  reportPanel: document.querySelector("#reportPanel"),
  overallScore: document.querySelector("#overallScore"),
  scoreGrid: document.querySelector("#scoreGrid"),
  correctionList: document.querySelector("#correctionList"),
  practiceList: document.querySelector("#practiceList"),
  pronunciationText: document.querySelector("#pronunciationText"),
  recordPronunciationBtn: document.querySelector("#recordPronunciationBtn"),
  mockPronunciationBtn: document.querySelector("#mockPronunciationBtn"),
  pronunciationResult: document.querySelector("#pronunciationResult"),
  eventLogList: document.querySelector("#eventLogList"),
  remoteAudio: document.querySelector("#remoteAudio"),
  remoteMediaRoot: document.querySelector("#remoteMediaRoot"),
  audioStrip: document.querySelector(".audio-strip"),
};

const statusLabels = {
  idle: "待开始",
  creating_session: "创建会话中",
  requesting_microphone: "等待麦克风",
  connected: "实时连接中",
  user_speaking: "用户发言中",
  ai_speaking: "AI 回复中",
  mock: "演示模式",
  disconnected: "连接断开",
  failed: "连接失败",
  closed: "已关闭",
  browser_voice: "稳定语音中",
  report_generating: "生成报告中",
  report_ready: "报告已生成",
  error: "出错",
};

const modeLabels = {
  unknown: "未知",
  starting: "启动中",
  mock: "演示兜底",
  "mock-ready": "演示模式就绪",
  browser_voice: "稳定实时语音",
  "browser-voice-ready": "稳定语音就绪",
  realtime: "OpenAI 实时语音",
  "realtime-ready": "OpenAI 就绪",
  "volc_doubao_setup": "豆包实时语音",
  "doubao-ready": "豆包已就绪",
  "doubao-needs-config": "豆包配置待补全",
  openai: "OpenAI",
  volc_doubao: "豆包 O2.0",
  deepseek: "DeepSeek 总结",
  "azure-speech": "Azure 发音",
  demo: "演示",
  "no-key": "未配置 OpenAI",
  "doubao-missing-config": "豆包配置缺失",
};

const scoreLabels = {
  taskCompletion: "任务完成度",
  fluency: "流利度",
  grammar: "语法",
  vocabulary: "词汇",
  interaction: "互动自然度",
  pronunciation: "发音总分",
  accuracy: "准确度",
  completeness: "完整度",
  prosody: "韵律",
};

function selectedScenario() {
  return state.scenarios.find((scenario) => scenario.id === state.selectedScenarioId) || state.scenarios[0];
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }
  return response.json();
}

function setStatus(status) {
  state.mode = status;
  els.statusPill.textContent = statusLabels[status] || status.replaceAll("_", " ");
  els.audioStrip.classList.toggle("live", ["connected", "user_speaking", "ai_speaking", "mock", "browser_voice"].includes(status));
  renderDiagnostics();
}

function logEvent(type, detail = "") {
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    type,
    detail,
  };
  state.eventLog.unshift(event);
  state.eventLog = state.eventLog.slice(0, 80);
  renderEventLog();
  reportClientEvent(event);
}

function reportClientEvent(event) {
  const payload = JSON.stringify({
    sessionId: state.sessionId,
    mode: state.sessionMode,
    provider: state.realtimeProvider,
    status: state.mode,
    type: event.type,
    detail: event.detail,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/client-events", new Blob([payload], { type: "application/json" }));
      return;
    }
    fetch("/api/client-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Diagnostics should never interrupt the practice flow.
  }
}

function renderDiagnostics() {
  const modeParts = [state.sessionMode || "unknown"];
  modeParts.push(state.realtimeProvider);
  if (state.health?.demoMode) modeParts.push("demo");
  if (state.realtimeProvider === "openai" && !state.health?.hasOpenAIKey) modeParts.push("no-key");
  if (state.realtimeProvider === "volc_doubao" && !state.health?.volcDoubao?.ready) modeParts.push("doubao-missing-config");
  if (state.health?.hasDeepSeekKey) modeParts.push("deepseek");
  if (state.health?.hasAzureSpeech) modeParts.push("azure-speech");
  els.modeLabel.textContent = modeParts.map(formatModeLabel).join(" / ");
  els.sessionIdLabel.textContent = state.sessionId || "暂无";
  els.turnCountLabel.textContent = String(state.turns.filter((turn) => turn.speaker === "user").length);
  els.exportSessionBtn.disabled = !state.sessionId && state.turns.length === 0;
}

function renderEventLog() {
  if (!state.eventLog.length) {
    els.eventLogList.innerHTML = `<div class="event-log-row"><time>--</time><strong>待开始</strong><p>暂无事件</p></div>`;
    return;
  }

  els.eventLogList.innerHTML = state.eventLog.map((event) => {
    const time = new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `
      <div class="event-log-row">
        <time>${time}</time>
        <strong>${escapeHtml(event.type)}</strong>
        <p>${escapeHtml(event.detail || "")}</p>
      </div>
    `;
  }).join("");
}

function renderScenarios() {
  els.scenarioList.innerHTML = "";
  state.scenarios.forEach((scenario) => {
    const button = document.createElement("button");
    button.className = `scenario-button ${scenario.id === state.selectedScenarioId ? "active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(displayScenarioLabel(scenario))}</strong><span>${escapeHtml(displayScenarioDescription(scenario))}</span>`;
    button.addEventListener("click", () => {
      state.selectedScenarioId = scenario.id;
      state.level = scenario.level;
      document.querySelectorAll(".segment").forEach((segment) => {
        segment.classList.toggle("active", segment.dataset.level === state.level);
      });
      renderAll();
    });
    els.scenarioList.append(button);
  });
}

function renderScenarioDetails() {
  const scenario = selectedScenario();
  if (!scenario) return;
  els.sessionEyebrow.textContent = `${scenario.userRoleZh || scenario.userRole} -> ${scenario.aiRoleZh || scenario.aiRole}`;
  els.sessionTitle.textContent = scenario.titleZh || scenario.title;
  const goals = scenario.goalsZh || scenario.goals;
  els.goalList.innerHTML = goals.map((goal) => `<li>${escapeHtml(goal)}</li>`).join("");
  els.keywordList.innerHTML = scenario.keywords.map((word) => `<span class="keyword">${word}</span>`).join("");
}

function renderTurns() {
  if (!state.turns.length) {
    els.transcriptList.innerHTML = `<div class="turn assistant"><div class="turn-label">AI 教练</div><div>${selectedScenario()?.openingPrompt || "请选择一个场景开始练习。"}</div></div>`;
    return;
  }

  els.transcriptList.innerHTML = state.turns.map((turn) => `
    <article class="turn ${turn.speaker}">
      <div class="turn-label">${turn.speaker === "user" ? "学习者" : "AI 教练"}</div>
      <div>${escapeHtml(turn.transcript)}</div>
    </article>
  `).join("");
  els.transcriptList.scrollTop = els.transcriptList.scrollHeight;
}

function renderAll() {
  renderScenarios();
  renderScenarioDetails();
  renderTurns();
  renderDiagnostics();
  renderEventLog();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatModeLabel(value) {
  return modeLabels[value] || String(value).replaceAll("_", " ");
}

function displayScenarioLabel(scenario) {
  return scenario.labelZh || scenario.label;
}

function displayScenarioDescription(scenario) {
  return scenario.descriptionZh || scenario.description;
}

function addTurn(speaker, transcript, source = "manual") {
  if (!transcript?.trim()) return;
  state.turns.push({
    id: `turn_${Date.now()}_${state.turns.length}`,
    speaker,
    sequence: state.turns.length + 1,
    transcript: transcript.trim(),
    source,
    createdAt: new Date().toISOString(),
  });
  logEvent(`turn:${speaker}`, `${source}: ${transcript.trim().slice(0, 120)}`);
  renderTurns();
  renderDiagnostics();
}

function mockAssistantReply(userText) {
  const scenario = selectedScenario();
  const fallback = scenario.followUpQuestions[state.turns.length % scenario.followUpQuestions.length];
  if (scenario.id === "restaurant_ordering") {
    return "Sure. Would you like that hot or iced?";
  }
  if (scenario.id === "business_meeting") {
    return "Thanks. What is the main blocker we should resolve first?";
  }
  if (userText.toLowerCase().includes("project")) {
    return "Good. What was your specific impact in that project?";
  }
  return fallback;
}

async function startPractice() {
  const scenario = selectedScenario();
  els.startBtn.disabled = true;
  els.reportPanel.classList.add("hidden");
  state.turns = [];
  state.eventLog = [];
  state.lastSummary = null;
  state.remoteAudioActive = false;
  state.browserVoiceFallback = false;
  state.browserVoiceRecognitionDisabled = false;
  stopBrowserVoiceFallback();
  state.sessionStartedAt = new Date().toISOString();
  state.sessionEndedAt = null;
  state.sessionMode = "starting";
  state.sessionReason = "";
  state.sessionId = null;
  state.pronunciationText = scenario.pronunciationSentences[0];
  state.lastRealtimeSetup = null;
  logEvent("session:start", `${scenario.id} / ${state.level} / ${state.correctionMode} / ${state.realtimeProvider}`);
  renderTurns();
  setStatus("creating_session");

  try {
    if (state.realtimeProvider === "browser_voice") {
      await startBrowserVoicePractice(scenario);
      els.endBtn.disabled = false;
      return;
    }

    const session = await apiJson("/api/realtime/session", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: scenario.id,
        level: state.level,
        correctionMode: state.correctionMode,
        provider: state.realtimeProvider,
        voice: state.voice,
        deferServerStart: state.realtimeProvider === "volc_doubao",
      }),
    });
    state.sessionId = session.sessionId;
    state.sessionMode = session.mode;
    state.sessionReason = session.reason || "";
    state.lastRealtimeSetup = session;
    logEvent("session:created", `${session.mode}${session.reason ? ` - ${session.reason}` : ""}`);

    if (session.mode === "realtime") {
      await connectRealtime(session.clientSecret);
      setStatus("connected");
    } else if (session.mode === "volc_doubao_setup") {
      logEvent("doubao:setup", `${session.model} / room=${session.roomId}`);
      if (session.serverStart) {
        logEvent(
          session.serverStart.ok ? "doubao:start_voice_chat" : `doubao:start_${session.serverStart.status}`,
          session.serverStart.requestId || session.serverStart.message || "",
        );
      }
      try {
        await connectVolcDoubaoRealtime(session);
        if (!session.serverStarted) {
          const startedSession = await startVolcDoubaoAgentAfterJoin(session, scenario);
          Object.assign(session, startedSession);
          state.lastRealtimeSetup = session;
        }
        setStatus("connected");
        addTurn(
          "assistant",
          session.serverStarted
            ? `${scenario.openingPrompt} (豆包 O2.0 已加入实时语音房间。)`
            : `${scenario.openingPrompt} (豆包 O2.0 配置已就绪；StartVoiceChat 状态：${session.serverStart?.status || "pending"}。)`,
          session.serverStarted ? "doubao_seed" : "mock",
        );
        scheduleDoubaoVoiceFallback(session, scenario);
      } catch (error) {
        setStatus("mock");
        logEvent("doubao:fallback", error.message || "RTC SDK connection pending");
        addTurn("assistant", `${scenario.openingPrompt} (豆包 O2.0 配置已就绪；${error.message || "RTC SDK connection pending"}。)`, "mock");
      }
    } else {
      setStatus("mock");
      addTurn("assistant", scenario.openingPrompt, "mock");
    }
    els.endBtn.disabled = false;
  } catch (error) {
    console.error(error);
    cleanupRealtime();
    state.sessionMode = "mock";
    state.sessionReason = error.message || "session failed";
    logEvent("session:error", state.sessionReason);
    setStatus("mock");
    addTurn("assistant", scenario.openingPrompt, "mock");
    els.endBtn.disabled = false;
  } finally {
    els.startBtn.disabled = false;
  }
}

async function startBrowserVoicePractice(scenario) {
  state.sessionId = `browser_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  state.sessionMode = "browser_voice";
  state.sessionReason = "Browser speech recognition + DeepSeek dialogue + speech synthesis";
  state.browserVoiceFallback = true;
  state.lastRealtimeSetup = {
    mode: "browser_voice",
    provider: "browser_voice",
    reason: state.sessionReason,
    model: state.health?.deepSeekTextModel || "deepseek",
  };

  logEvent("browser_voice:start", state.sessionReason);
  setStatus("browser_voice");
  addTurn("assistant", scenario.openingPrompt, "browser_voice");
  requestBrowserMicrophone();
  speakAssistantText(scenario.openingPrompt, { listenAfter: true });
}

async function startVolcDoubaoAgentAfterJoin(session, scenario) {
  logEvent("doubao:start_after_join", "starting agent after RTC join and microphone publish");
  const result = await apiJson(`/api/realtime/session/${session.sessionId}/start`, {
    method: "POST",
    body: JSON.stringify({
      scenarioId: scenario.id,
      level: state.level,
      correctionMode: state.correctionMode,
    }),
  });
  const serverStart = result.serverStart || { ok: false, status: "unknown" };
  logEvent(
    serverStart.ok ? "doubao:start_voice_chat" : `doubao:start_${serverStart.status}`,
    serverStart.requestId || serverStart.message || "",
  );
  return {
    ...session,
    ...result,
    serverStart,
    serverStarted: Boolean(result.serverStarted),
  };
}

function scheduleDoubaoVoiceFallback(session, scenario) {
  window.setTimeout(() => {
    if (state.sessionId !== session.sessionId) return;
    if (state.remoteAudioActive || state.browserVoiceFallback) return;
    logEvent("doubao:no_remote_audio", "no remote publish event after StartVoiceChat; switching to browser voice fallback");
    startBrowserVoiceFallback(scenario);
  }, 5000);
}

function startBrowserVoiceFallback(scenario) {
  state.browserVoiceFallback = true;
  setStatus("browser_voice");
  addTurn("assistant", `${scenario.openingPrompt} (豆包远端音频未发布，已切换浏览器语音兜底。)`, "browser_voice_fallback");
  speakAssistantText(scenario.openingPrompt, { listenAfter: true });
}

function startBrowserVoiceRecognition() {
  if (state.browserVoiceRecognitionDisabled) {
    logEvent("browser_voice:recognition_disabled", "use typed input or open in Chrome");
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    logEvent("browser_voice:recognition_unavailable", "SpeechRecognition is not available");
    return;
  }

  try {
    state.browserVoiceRecognition?.stop?.();
  } catch {
    // Ignore stop races before starting a fresh recognition turn.
  }
  state.browserVoiceRecognition = null;
  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  state.browserVoiceRecognition = recognition;

  recognition.addEventListener("result", async (event) => {
    if (state.browserVoiceBusy) return;
    const latest = event.results[event.results.length - 1];
    if (!latest?.isFinal || !latest[0]?.transcript) return;
    const transcript = latest[0].transcript.trim();
    if (!transcript) return;
    state.browserVoiceBusy = true;
    try {
      recognition.stop();
    } catch {
      // Ignore stop races after a final result.
    }
    setStatus("user_speaking");
    addTurn("user", transcript, "browser_speech_recognition");
    logEvent("browser_voice:thinking", transcript.slice(0, 120));
    const reply = await createDialogueReply(transcript);
    addTurn("assistant", reply.reply, reply.source || "browser_voice_reply");
    speakAssistantText(reply.reply, { listenAfter: true });
  });

  recognition.addEventListener("error", (event) => {
    logEvent("browser_voice:recognition_error", event.error || "speech recognition failed");
    if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
      state.browserVoiceRecognitionDisabled = true;
      state.browserVoiceBusy = false;
      if (els.mockInput) {
        els.mockInput.placeholder = "当前浏览器禁止自动语音识别，请在这里输入英文回答；用系统 Chrome 可自动听写";
      }
      try {
        recognition.stop();
      } catch {
        // Ignore stop races after permission denial.
      }
    }
  });
  recognition.addEventListener("end", () => {
    if (state.browserVoiceFallback && !state.browserVoiceBusy && !state.browserVoiceRecognitionDisabled) {
      try {
        recognition.start();
      } catch {
        // The browser may require a short pause before restarting recognition.
      }
    }
  });

  try {
    recognition.start();
    logEvent("browser_voice:recognition", "started");
  } catch (error) {
    logEvent("browser_voice:recognition_error", error.message || "start failed");
  }
}

function speakAssistantText(text, options = {}) {
  return speakAssistantTextWithOptions(text, options);
}

function speakAssistantTextWithOptions(text, options = {}) {
  if (state.realtimeProvider === "browser_voice" || state.browserVoiceFallback || !window.speechSynthesis || !text) {
    return playAssistantAudioFromServer(text, options);
  }

  state.browserVoiceBusy = true;
  setStatus("ai_speaking");
  try {
    state.browserVoiceRecognition?.stop?.();
  } catch {
    // Ignore recognition stop races while speaking.
  }

  const utterance = new SpeechSynthesisUtterance(stripParenthetical(text));
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.addEventListener("end", () => {
    state.browserVoiceBusy = false;
    if (state.browserVoiceFallback) {
      setStatus("browser_voice");
      if (options.listenAfter) startBrowserVoiceRecognition();
    }
  });
  utterance.addEventListener("error", (event) => {
    state.browserVoiceBusy = false;
    logEvent("browser_voice:synthesis_error", event.error || "speech synthesis failed");
    if (options.listenAfter && state.browserVoiceFallback) startBrowserVoiceRecognition();
  });
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  logEvent("browser_voice:speak", stripParenthetical(text).slice(0, 120));
}

async function playAssistantAudioFromServer(text, options = {}) {
  if (!text) return;
  state.browserVoiceBusy = true;
  setStatus("ai_speaking");
  try {
    state.browserVoiceRecognition?.stop?.();
  } catch {
    // Ignore recognition stop races while server audio is playing.
  }

  try {
    const cleanText = stripParenthetical(text);
    logEvent("browser_voice:server_tts", cleanText.slice(0, 120));
    const result = await apiJson("/api/tts", {
      method: "POST",
      body: JSON.stringify({ text: cleanText }),
    });
    state.lastGeneratedAudio = {
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      text: cleanText,
    };
    if (els.testVoiceBtn) els.testVoiceBtn.textContent = "播放 AI 语音";
    await playGeneratedAudio(result.audioBase64, result.mimeType);
  } catch (error) {
    logEvent("browser_voice:server_tts_error", error.message || "local TTS failed");
  } finally {
    state.browserVoiceBusy = false;
    if (state.browserVoiceFallback) {
      setStatus("browser_voice");
      if (options.listenAfter) startBrowserVoiceRecognition();
    }
  }
}

async function playGeneratedAudio(audioBase64, mimeType) {
  revokeGeneratedAudioUrl();
  const bytes = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType || "audio/mp4" });
  state.generatedAudioUrl = URL.createObjectURL(blob);
  await playAudioUrl(state.generatedAudioUrl);
}

function playAudioUrl(url) {
  return new Promise((resolve) => {
    const audio = els.remoteAudio || new Audio();
    let settled = false;
    let started = false;
    let timeoutId = null;
    let startTimeoutId = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(startTimeoutId);
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("playing", onPlaying);
      resolve();
    };
    const onError = () => {
      logEvent("browser_voice:audio_error", "audio element could not play generated speech");
      finish();
    };
    const onPlaying = () => {
      started = true;
      logEvent("browser_voice:audio_playing", `${Math.round(audio.duration * 1000) || 0}ms`);
    };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.addEventListener("playing", onPlaying, { once: true });
    audio.srcObject = null;
    audio.preload = "auto";
    audio.src = url;
    audio.load();
    timeoutId = window.setTimeout(() => {
      if (!audio.ended) {
        logEvent("browser_voice:audio_timeout", `currentTime=${audio.currentTime || 0}`);
      }
      finish();
    }, 30000);
    startTimeoutId = window.setTimeout(() => {
      if (!started && (audio.currentTime || 0) < 0.05) {
        audio.pause();
        logEvent("browser_voice:audio_needs_click", "click the play voice button");
        finish();
      }
    }, 2500);
    audio.play().catch((error) => {
      logEvent("browser_voice:audio_play_error", error.message || "playback blocked");
      finish();
    });
  });
}

function revokeGeneratedAudioUrl() {
  if (!state.generatedAudioUrl) return;
  URL.revokeObjectURL(state.generatedAudioUrl);
  state.generatedAudioUrl = null;
}

function unlockAudioPlayback() {
  if (state.audioUnlocked) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.03);
    context.resume().then(() => {
      state.audioUnlocked = true;
      logEvent("browser_voice:audio_unlocked", "AudioContext resumed");
    }).catch(() => {});
  } catch {
    // Audio unlock is a best-effort browser gesture helper.
  }
}

async function requestBrowserMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    logEvent("browser_voice:microphone_unavailable", "getUserMedia is not available");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.localStream = stream;
    logEvent("browser_voice:microphone", "permission granted");
  } catch (error) {
    logEvent("browser_voice:microphone_error", error.message || "microphone permission failed");
  }
}

async function createDialogueReply(userText) {
  try {
    return await apiJson("/api/dialogue/reply", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: selectedScenario().id,
        level: state.level,
        userText,
        turns: state.turns,
      }),
    });
  } catch (error) {
    logEvent("browser_voice:reply_error", error.message || "reply failed");
    return {
      source: "local_fallback",
      reply: mockAssistantReply(userText),
    };
  }
}

function stopBrowserVoiceFallback({ keepFlag = false } = {}) {
  try {
    state.browserVoiceRecognition?.stop?.();
  } catch {
    // Ignore stop races.
  }
  try {
    window.speechSynthesis?.cancel?.();
  } catch {
    // Ignore synthesis cleanup errors.
  }
  state.browserVoiceRecognition = null;
  state.browserVoiceBusy = false;
  if (!keepFlag) state.browserVoiceFallback = false;
}

function stripParenthetical(text) {
  return String(text).replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

async function connectRealtime(clientSecret) {
  setStatus("requesting_microphone");
  logEvent("webrtc:microphone", "requesting permission");
  const pc = new RTCPeerConnection();
  state.peerConnection = pc;

  pc.ontrack = (event) => {
    els.remoteAudio.srcObject = event.streams[0];
    logEvent("webrtc:track", "remote audio track received");
    setStatus("ai_speaking");
  };

  pc.onconnectionstatechange = () => {
    logEvent("webrtc:state", pc.connectionState);
    if (pc.connectionState === "connected") setStatus("connected");
    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setStatus(pc.connectionState);
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.localStream = stream;
  pc.addTrack(stream.getTracks()[0], stream);
  logEvent("webrtc:microphone", "permission granted");

  const dc = pc.createDataChannel("oai-events");
  state.dataChannel = dc;
  dc.addEventListener("open", () => logEvent("realtime:data_channel", "open"));
  dc.addEventListener("close", () => logEvent("realtime:data_channel", "closed"));
  dc.addEventListener("message", (event) => {
    try {
      handleRealtimeEvent(JSON.parse(event.data));
    } catch (error) {
      logEvent("realtime:event_error", error.message || "Unable to parse event");
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  logEvent("webrtc:sdp", "local offer created");

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!response.ok) {
    throw new Error(`Realtime SDP exchange failed: ${response.status}`);
  }

  await pc.setRemoteDescription({
    type: "answer",
    sdp: await response.text(),
  });
  logEvent("webrtc:sdp", "remote answer applied");
}

async function connectVolcDoubaoRealtime(session) {
  if (!session.clientToken) {
    throw new Error("missing VOLC_RTC_CLIENT_TOKEN");
  }
  if (!session.rtcAppId || !session.roomId || !session.userId) {
    throw new Error("missing RTC join parameters");
  }

  setStatus("requesting_microphone");
  logEvent("doubao:rtc", "requesting microphone permission");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.localStream = stream;

  const sdk = await loadVolcRtcSdk(session.sdkUrl);
  logEvent("doubao:rtc_sdk", `${session.sdkSource || "sdk"}${session.sdkVersion ? ` / ${session.sdkVersion}` : ""}`);
  const createEngine = sdk?.createEngine || sdk?.default?.createEngine;
  if (typeof createEngine !== "function") {
    throw new Error("Volc RTC SDK createEngine is unavailable");
  }

  const engine = createEngine(session.rtcAppId);
  state.volcRtcEngine = engine;
  state.volcRtcRoom = session.roomId;
  registerVolcRtcEventHandlers(engine, sdk, session);

  if (typeof engine.startAudioCapture === "function") {
    await engine.startAudioCapture();
    logEvent("doubao:audio_capture", "started");
  }

  if (typeof engine.joinRoom !== "function") {
    throw new Error("Volc RTC SDK joinRoom is unavailable");
  }

  const roomConfig = {
    isAutoPublish: true,
    isAutoSubscribeAudio: true,
    isAutoSubscribeVideo: false,
  };
  if (sdk.RoomProfileType?.communication !== undefined) {
    roomConfig.roomProfileType = sdk.RoomProfileType.communication;
  }
  await engine.joinRoom(session.clientToken, session.roomId, { userId: session.userId }, roomConfig);
  logEvent("doubao:rtc", `joined room ${session.roomId}`);

  if (typeof engine.publishStream === "function") {
    try {
      await engine.publishStream(resolveVolcMediaType(sdk, "audio"));
      logEvent("doubao:publish_audio", "published");
    } catch (error) {
      logEvent("doubao:publish_audio_error", error.message || "publish audio failed");
    }
  }
}

function registerVolcRtcEventHandlers(engine, sdk, session) {
  bindVolcRtcEvent(engine, sdk, "onUserJoined", (event) => {
    logEvent("doubao:user_joined", extractVolcEventUserId(event) || "remote");
  });
  bindVolcRtcEvent(engine, sdk, "onUserLeave", (event) => {
    logEvent("doubao:user_left", extractVolcEventUserId(event) || "remote");
  });
  bindVolcRtcEvent(engine, sdk, "onUserPublishStream", async (event) => {
    await handleVolcRemoteStreamPublished(engine, sdk, event, session);
  });
  bindVolcRtcEvent(engine, sdk, "onUserUnpublishStream", (event) => {
    logEvent("doubao:remote_unpublish", `${extractVolcEventUserId(event) || "remote"} / ${extractVolcEventMediaType(event) || "media"}`);
  });
  bindVolcRtcEvent(engine, sdk, "onUserMessageReceived", (event) => {
    handleVolcRtcMessage(event, session, "user_message");
  });
  bindVolcRtcEvent(engine, sdk, "onRoomMessageReceived", (event) => {
    handleVolcRtcMessage(event, session, "room_message");
  });
  bindVolcRtcEvent(engine, sdk, "onSubtitleMessageReceived", (event) => {
    handleVolcRtcMessage(event, session, "subtitle");
  });
  bindVolcRtcEvent(engine, sdk, "onRoomStateChanged", (event) => {
    logEvent("doubao:room_state", stringifyCompact(event).slice(0, 120));
  });
  bindVolcRtcEvent(engine, sdk, "onConnectionStateChanged", (event) => {
    logEvent("doubao:connection", stringifyCompact(event).slice(0, 120));
  });
}

async function handleVolcRemoteStreamPublished(engine, sdk, event, session) {
  const userId = extractVolcEventUserId(event);
  const mediaType = event?.mediaType ?? event?.MediaType ?? resolveVolcMediaType(sdk, "audio");
  if (!userId || userId === session.userId) return;

  logEvent("doubao:remote_publish", `${userId} / ${extractVolcEventMediaType(event) || mediaType}`);
  try {
    if (typeof engine.subscribeStream === "function") {
      await engine.subscribeStream(userId, mediaType);
      logEvent("doubao:subscribe", `${userId}`);
    }
    await playVolcRemoteStream(engine, sdk, userId, mediaType);
    state.remoteAudioActive = true;
    stopBrowserVoiceFallback();
    setStatus("ai_speaking");
  } catch (error) {
    logEvent("doubao:subscribe_error", error.message || "remote subscribe failed");
  }
}

async function playVolcRemoteStream(engine, sdk, userId, mediaType) {
  const streamIndex = resolveVolcStreamIndex(sdk);
  const playerId = ensureVolcRemotePlayer(userId);
  if (typeof engine.setRemoteVideoPlayer === "function") {
    try {
      engine.setRemoteVideoPlayer(streamIndex, {
        userId,
        renderDom: playerId,
        playerId,
      });
    } catch (error) {
      logEvent("doubao:player_bind_error", error.message || "remote player bind failed");
    }
  }
  if (typeof engine.play === "function") {
    await engine.play(userId, mediaType, streamIndex, playerId);
    logEvent("doubao:play_remote", `${userId}`);
  }
}

function ensureVolcRemotePlayer(userId) {
  const safeId = `remote_${String(userId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  if (!els.remoteMediaRoot) return safeId;
  let node = document.getElementById(safeId);
  if (!node) {
    node = document.createElement("div");
    node.id = safeId;
    els.remoteMediaRoot.append(node);
  }
  return safeId;
}

function resolveVolcMediaType(sdk, type) {
  const mediaType = sdk?.MediaType || window.VERTC?.MediaType || {};
  if (type === "audio") {
    return mediaType.AUDIO ?? mediaType.AUDIO_ONLY ?? 1;
  }
  return mediaType.AUDIO_AND_VIDEO ?? mediaType.AUDIO_VIDEO ?? mediaType.VIDEO ?? 3;
}

function resolveVolcStreamIndex(sdk) {
  const streamIndex = sdk?.StreamIndex || window.VERTC?.StreamIndex || {};
  return streamIndex.STREAM_INDEX_MAIN ?? streamIndex.MAIN ?? 0;
}

function bindVolcRtcEvent(engine, sdk, eventName, handler) {
  if (typeof engine?.on !== "function") return;
  const eventKey = sdk?.events?.[eventName] || sdk?.RTCEvents?.[eventName] || eventName;
  try {
    engine.on(eventKey, handler);
  } catch (error) {
    logEvent("doubao:event_bind_error", `${eventName}: ${error.message || "bind failed"}`);
  }
}

function handleVolcRtcMessage(event, session, source) {
  const payload = normalizeVolcMessagePayload(event);
  const subtitle = extractVolcSubtitle(payload);
  if (!subtitle.text) {
    logEvent(`doubao:${source}`, stringifyCompact(payload).slice(0, 140));
    return;
  }
  if (subtitle.definite === false) {
    logEvent("doubao:subtitle_partial", subtitle.text.slice(0, 120));
    return;
  }
  const speaker = subtitle.userId === session.userId ? "user" : "assistant";
  addTurn(speaker, subtitle.text, `doubao_${source}`);
}

function normalizeVolcMessagePayload(event) {
  const candidate = event?.message ?? event?.data ?? event?.detail ?? event?.payload ?? event;
  if (typeof candidate === "string") {
    try {
      return JSON.parse(candidate);
    } catch {
      return { text: candidate };
    }
  }
  if (candidate instanceof ArrayBuffer) {
    return { text: new TextDecoder().decode(candidate) };
  }
  return candidate || {};
}

function extractVolcSubtitle(payload) {
  const data = payload?.data || payload?.Data || payload?.subtitle || payload?.Subtitle || payload;
  return {
    text: data?.text || data?.Text || data?.content || data?.Content || "",
    userId: data?.userId || data?.UserId || data?.uid || data?.Uid || payload?.uid || "",
    definite: data?.definite ?? data?.Definite ?? data?.isFinal ?? data?.IsFinal ?? true,
  };
}

function extractVolcEventUserId(event) {
  return event?.userInfo?.userId
    || event?.userInfo?.uid
    || event?.userId
    || event?.uid
    || event?.UserId
    || event?.user?.userId
    || "";
}

function extractVolcEventMediaType(event) {
  return event?.mediaType ?? event?.MediaType ?? event?.type ?? "";
}

function stringifyCompact(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value || "");
  }
}

async function loadVolcRtcSdk(sdkUrl) {
  const existingSdk = getVolcRtcGlobal();
  if (existingSdk) return existingSdk;
  if (!sdkUrl) throw new Error("missing Volc RTC Web SDK URL");
  const normalizedUrl = new URL(sdkUrl, document.baseURI).href;

  await withTimeout(new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find((script) => script.src === normalizedUrl);
    if (existing) {
      if (getVolcRtcGlobal()) {
        resolve();
        return;
      }
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = normalizedUrl;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("failed to load Volc RTC SDK")), { once: true });
    document.head.append(script);
  }), 15000, "Volc RTC SDK load timed out");

  const sdk = await waitForVolcRtcGlobal();
  if (!sdk) throw new Error("Volc RTC SDK did not register window.VERTC");
  return sdk;
}

function getVolcRtcGlobal() {
  const sdk = window.VERTC;
  return sdk?.createEngine || sdk?.default?.createEngine ? sdk : null;
}

async function waitForVolcRtcGlobal(timeoutMs = 3000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const sdk = getVolcRtcGlobal();
    if (sdk) return sdk;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return getVolcRtcGlobal();
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function handleRealtimeEvent(event) {
  logEvent("realtime:event", event.type);
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    addTurn("user", event.transcript, "realtime_transcript");
    setStatus("connected");
  }
  if (event.type === "response.audio_transcript.done") {
    addTurn("assistant", event.transcript, "realtime_transcript");
    setStatus("connected");
  }
  if (event.type === "input_audio_buffer.speech_started") setStatus("user_speaking");
  if (event.type === "response.created") setStatus("ai_speaking");
}

async function endPractice() {
  await stopRealtimeAgent();
  cleanupRealtime();
  state.sessionEndedAt = new Date().toISOString();
  logEvent("session:end", `turns=${state.turns.length}`);
  setStatus("report_generating");
  els.endBtn.disabled = true;

  const scenario = selectedScenario();
  const summary = await apiJson(`/api/sessions/${state.sessionId || "mock"}/summary`, {
    method: "POST",
    body: JSON.stringify({
      scenarioId: scenario.id,
      level: state.level,
      turns: state.turns,
    }),
  });

  state.lastSummary = summary;
  logEvent("summary:ready", `score=${summary.overallScore}`);
  renderReport(summary);
  setStatus("report_ready");
}

async function stopRealtimeAgent() {
  const session = state.lastRealtimeSetup;
  if (session?.provider !== "volc_doubao" || !state.sessionId) return;
  if (!session.roomId || !session.taskId) return;

  try {
    logEvent("doubao:stop_voice_chat", session.taskId);
    const result = await apiJson(`/api/realtime/session/${state.sessionId}/stop`, {
      method: "POST",
      body: JSON.stringify({
        roomId: session.roomId,
        taskId: session.taskId,
      }),
    });
    logEvent(result.ok ? "doubao:stop_done" : `doubao:stop_${result.status}`, result.requestId || result.message || "");
  } catch (error) {
    logEvent("doubao:stop_error", error.message || "StopVoiceChat failed");
  }
}

function cleanupRealtime() {
  stopBrowserVoiceFallback();
  if (state.peerConnection || state.localStream || state.volcRtcEngine) {
    logEvent("webrtc:cleanup", "closing local media and realtime connection");
  }
  state.dataChannel?.close();
  state.peerConnection?.close();
  try {
    state.volcRtcEngine?.leaveRoom?.();
    state.volcRtcEngine?.destroyEngine?.();
    state.volcRtcEngine?.destroy?.();
  } catch (error) {
    logEvent("doubao:cleanup_error", error.message || "cleanup failed");
  }
  state.localStream?.getTracks().forEach((track) => track.stop());
  state.dataChannel = null;
  state.peerConnection = null;
  state.localStream = null;
  state.volcRtcEngine = null;
  state.volcRtcRoom = null;
  revokeGeneratedAudioUrl();
}

function renderReport(summary) {
  els.reportPanel.classList.remove("hidden");
  els.overallScore.textContent = summary.overallScore;
  els.overallScore.style.background = `conic-gradient(var(--teal) ${summary.overallScore}%, #edf1ed 0)`;
  els.scoreGrid.innerHTML = Object.entries(summary.scores).map(([label, value]) => `
    <div class="score-card">
      <span>${scoreLabels[label] || label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
  els.correctionList.innerHTML = summary.corrections.map((item) => `
    <article class="correction">
      <div><del>${escapeHtml(item.original)}</del></div>
      <div><ins>${escapeHtml(item.corrected)}</ins></div>
      <p>${escapeHtml(item.explanationZh)}</p>
      <strong>${escapeHtml(item.betterExpression || "")}</strong>
    </article>
  `).join("");
  els.practiceList.innerHTML = summary.practiceTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("");
  state.pronunciationText = summary.recommendedPronunciationText || selectedScenario().pronunciationSentences[0];
  els.pronunciationText.textContent = state.pronunciationText;
  els.pronunciationResult.innerHTML = "";
  state.lastPronunciationResult = null;
}

async function scorePronunciation() {
  logEvent("pronunciation:score", state.pronunciationText || selectedScenario().pronunciationSentences[0]);
  if (!state.pronunciationAudio) {
    els.pronunciationResult.innerHTML = `<p class="audio-note">请先点击“录音”，读出推荐句子后再评分。</p>`;
    logEvent("pronunciation:needs_recording", "no audio");
    return;
  }
  try {
    const result = await apiJson("/api/pronunciation/scripted", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: selectedScenario().id,
        referenceText: state.pronunciationText || selectedScenario().pronunciationSentences[0],
        audioBase64: state.pronunciationAudio?.base64,
        mimeType: state.pronunciationAudio?.mimeType,
        durationMs: state.pronunciationAudio?.durationMs,
        recognizedTranscript: state.pronunciationRecognition?.transcript || "",
        recognitionConfidence: state.pronunciationRecognition?.confidence || null,
        language: "en-US",
      }),
    });
    renderPronunciationResult(result);
  } catch (error) {
    logEvent("pronunciation:error", error.message || "scoring failed");
    els.pronunciationResult.innerHTML = `<p class="audio-note">评分失败：${escapeHtml(error.message || "请重试。")}</p>`;
  }
}

function renderPronunciationResult(result) {
  state.lastPronunciationResult = result;
  const weakWords = Array.isArray(result.weakWords) ? result.weakWords : [];
  const provider = result.source || "unknown";
  const providerDetail = result.providerError
    ? `Azure 不可用，已改用浏览器识别结果评分：${result.providerError}`
    : result.source === "browser_speech_recognition"
      ? "评分基于本次录音和浏览器识别文本。"
      : result.source === "audio_no_recognition"
        ? "已收到录音，但没有识别到清晰英文，分数会偏低。"
        : "请先录音后再评分。";
  const transcriptHtml = result.transcript || result.recognizedTranscript
    ? `<p class="audio-note">识别文本：${escapeHtml(result.transcript || result.recognizedTranscript)}</p>`
    : "";
  logEvent("pronunciation:ready", `${provider} / score=${result.pronunciation}${result.audioReceived ? " / audio" : ""}`);
  els.pronunciationResult.innerHTML = `
    <div class="score-grid">
      ${["pronunciation", "accuracy", "fluency", "completeness", "prosody"].map((key) => `
        <div class="score-card"><span>${scoreLabels[key] || key}</span><strong>${result[key]}</strong></div>
      `).join("")}
    </div>
    <div>
      ${weakWords.map((item) => `
        <span class="weak-word">${escapeHtml(item.word)} ${item.score}: ${escapeHtml(item.tipZh)}</span>
      `).join("")}
    </div>
    <p>${escapeHtml(result.adviceZh)}</p>
    ${transcriptHtml}
    <p class="audio-note">评分来源：${escapeHtml(provider)}。${escapeHtml(providerDetail)}</p>
  `;
}

async function recordPronunciation() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    await scorePronunciation();
    return;
  }
  if (state.mediaRecorder?.state === "recording") {
    stopPronunciationRecognition();
    state.mediaRecorder.stop();
    els.recordPronunciationBtn.textContent = "录音";
    return;
  }

  state.pronunciationAudio = null;
  state.pronunciationRecognition = null;
  els.pronunciationResult.innerHTML = "";
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    logEvent("pronunciation:error", error.message || "microphone unavailable");
    await scorePronunciation();
    return;
  }

  const preferredMimeType = choosePronunciationMimeType();
  let recorder;
  try {
    recorder = preferredMimeType
      ? new MediaRecorder(stream, { mimeType: preferredMimeType })
      : new MediaRecorder(stream);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    logEvent("pronunciation:error", error.message || "recording unavailable");
    await scorePronunciation();
    return;
  }

  state.mediaRecorder = recorder;
  const startedAt = performance.now();
  const chunks = [];
  startPronunciationRecognition();
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) chunks.push(event.data);
  });
  recorder.addEventListener("stop", async () => {
    stopPronunciationRecognition();
    state.mediaRecorder = null;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    state.pronunciationAudio = {
      base64: await blobToBase64(blob),
      mimeType: blob.type || "audio/webm",
      sizeBytes: blob.size,
      durationMs: Math.round(performance.now() - startedAt),
      recordedAt: new Date().toISOString(),
    };
    logEvent(
      "pronunciation:recorded",
      `${state.pronunciationAudio.mimeType} / ${state.pronunciationAudio.sizeBytes} bytes / transcript=${state.pronunciationRecognition?.transcript || "none"}`,
    );
    await scorePronunciation();
  });
  recorder.start();
  logEvent("pronunciation:record", "started");
  els.recordPronunciationBtn.textContent = "停止录音";
}

function startPronunciationRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    logEvent("pronunciation:recognition", "browser speech recognition unavailable");
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  state.speechRecognition = recognition;
  state.pronunciationRecognition = {
    transcript: "",
    confidence: null,
    source: "browser_speech_recognition",
  };

  recognition.addEventListener("result", (event) => {
    let finalText = "";
    let interimText = "";
    let confidence = null;
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const alternative = result[0];
      if (!alternative?.transcript) continue;
      if (result.isFinal) {
        finalText += ` ${alternative.transcript}`;
        confidence = Math.max(confidence || 0, Number(alternative.confidence) || 0);
      } else {
        interimText += ` ${alternative.transcript}`;
      }
    }
    state.pronunciationRecognition = {
      transcript: (finalText || interimText).trim(),
      confidence,
      source: "browser_speech_recognition",
    };
  });

  recognition.addEventListener("error", (event) => {
    logEvent("pronunciation:recognition_error", event.error || "speech recognition failed");
  });
  recognition.addEventListener("end", () => {
    state.speechRecognition = null;
  });

  try {
    recognition.start();
    logEvent("pronunciation:recognition", "started");
  } catch (error) {
    logEvent("pronunciation:recognition_error", error.message || "start failed");
  }
}

function stopPronunciationRecognition() {
  try {
    state.speechRecognition?.stop?.();
  } catch (error) {
    logEvent("pronunciation:recognition_error", error.message || "stop failed");
  }
}

function choosePronunciationMimeType() {
  if (typeof MediaRecorder.isTypeSupported !== "function") return "";
  const candidates = [
    "audio/ogg;codecs=opus",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function wireEvents() {
  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.level = button.dataset.level;
      document.querySelectorAll(".segment").forEach((segment) => {
        segment.classList.toggle("active", segment === button);
      });
    });
  });

  els.correctionMode.addEventListener("change", (event) => {
    state.correctionMode = event.target.value;
  });
  els.realtimeProvider.addEventListener("change", (event) => {
    state.realtimeProvider = event.target.value;
    state.sessionMode = realtimeReadinessLabel(state.health);
    renderDiagnostics();
  });
  els.voiceSelect.addEventListener("change", (event) => {
    state.voice = event.target.value;
  });
  els.startBtn.addEventListener("click", () => {
    unlockAudioPlayback();
    startPractice();
  });
  els.endBtn.addEventListener("click", endPractice);
  els.testVoiceBtn?.addEventListener("click", () => {
    state.browserVoiceFallback = true;
    unlockAudioPlayback();
    if (state.lastGeneratedAudio?.audioBase64) {
      playGeneratedAudio(state.lastGeneratedAudio.audioBase64, state.lastGeneratedAudio.mimeType);
      return;
    }
    speakAssistantText("Voice test. If you can hear this sentence, browser audio is working.");
  });
  els.sendMockBtn.addEventListener("click", async () => {
    unlockAudioPlayback();
    const value = els.mockInput.value.trim();
    if (!value) return;
    els.mockInput.value = "";
    addTurn("user", value, state.browserVoiceFallback || state.realtimeProvider === "browser_voice" ? "typed_live" : "typed_mock");
    if (state.browserVoiceFallback || state.realtimeProvider === "browser_voice") {
      setStatus("ai_speaking");
      const reply = await createDialogueReply(value);
      addTurn("assistant", reply.reply, reply.source || "browser_voice_reply");
      speakAssistantText(reply.reply);
      return;
    }
    addTurn("assistant", mockAssistantReply(value), "mock");
  });
  els.mockInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") els.sendMockBtn.click();
  });
  els.mockPronunciationBtn.addEventListener("click", scorePronunciation);
  els.recordPronunciationBtn.addEventListener("click", recordPronunciation);
  els.exportSessionBtn.addEventListener("click", exportSessionJson);
}

async function init() {
  state.health = await apiJson("/api/health");
  state.realtimeProvider = "browser_voice";
  if (els.realtimeProvider) els.realtimeProvider.value = state.realtimeProvider;
  configureSpeechSupportNotice();
  state.sessionMode = realtimeReadinessLabel(state.health);
  logEvent("app:health", `${state.sessionMode} / ${state.health.realtimeModel || state.health.volcDoubao?.model || "mock"}`);
  const data = await apiJson("/api/scenarios");
  state.scenarios = data.scenarios;
  state.selectedScenarioId = state.scenarios[0].id;
  state.level = state.scenarios[0].level;
  wireEvents();
  renderAll();
}

function configureSpeechSupportNotice() {
  const hasRecognition = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasSynthesis = Boolean(window.speechSynthesis);
  if (!hasRecognition && els.mockInput) {
    els.mockInput.placeholder = "当前浏览器不支持自动语音识别，可在这里输入英文回答；用系统 Chrome 打开可自动听写";
  }
  if (!hasSynthesis) {
    logEvent("browser_voice:synthesis_unavailable", "using local server TTS");
  }
  if (!hasRecognition) {
    logEvent("browser_voice:recognition_unavailable", "use Chrome for automatic speech recognition");
  }
}

function buildSessionSnapshot() {
  const scenario = selectedScenario();
  return {
    exportedAt: new Date().toISOString(),
    session: {
      id: state.sessionId,
      mode: state.sessionMode,
      reason: state.sessionReason,
      status: state.mode,
      startedAt: state.sessionStartedAt,
      endedAt: state.sessionEndedAt,
    },
    config: {
      scenarioId: scenario?.id,
      scenarioTitle: scenario?.title,
      level: state.level,
      correctionMode: state.correctionMode,
      realtimeProvider: state.realtimeProvider,
      voice: state.voice,
      realtimeModel: state.health?.realtimeModel,
      volcDoubaoModel: state.health?.volcDoubao?.model,
      transcribeModel: state.health?.transcribeModel,
    },
    realtimeSetup: state.lastRealtimeSetup ? {
      mode: state.lastRealtimeSetup.mode,
      provider: state.lastRealtimeSetup.provider,
      reason: state.lastRealtimeSetup.reason,
      model: state.lastRealtimeSetup.model,
      rtcAppId: state.lastRealtimeSetup.rtcAppId,
      sdkSource: state.lastRealtimeSetup.sdkSource,
      sdkVersion: state.lastRealtimeSetup.sdkVersion,
      roomId: state.lastRealtimeSetup.roomId,
      userId: state.lastRealtimeSetup.userId,
      agentUserId: state.lastRealtimeSetup.agentUserId,
      serverStartRequired: state.lastRealtimeSetup.serverStartRequired,
      clientJoinReady: state.lastRealtimeSetup.clientJoinReady,
    } : null,
    turns: state.turns,
    summary: state.lastSummary,
    pronunciationText: state.pronunciationText,
    pronunciationAudio: state.pronunciationAudio ? {
      mimeType: state.pronunciationAudio.mimeType,
      sizeBytes: state.pronunciationAudio.sizeBytes,
      durationMs: state.pronunciationAudio.durationMs,
      recordedAt: state.pronunciationAudio.recordedAt,
    } : null,
    pronunciationRecognition: state.pronunciationRecognition,
    pronunciationResult: state.lastPronunciationResult,
    events: [...state.eventLog].reverse(),
  };
}

function realtimeReadinessLabel(health) {
  if (state.realtimeProvider === "browser_voice") return "browser-voice-ready";
  if (state.realtimeProvider === "volc_doubao") {
    return health.volcDoubao?.ready ? "doubao-ready" : "doubao-needs-config";
  }
  if (state.realtimeProvider === "mock") return "mock-ready";
  return health.hasOpenAIKey ? "realtime-ready" : "mock-ready";
}

function exportSessionJson() {
  const snapshot = buildSessionSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${snapshot.session.id || "practice-session"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  logEvent("session:export", link.download);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("loadend", () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

init().catch((error) => {
  console.error(error);
  setStatus("error");
});
