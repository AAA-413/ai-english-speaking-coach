const state = {
  scenarios: [],
  selectedScenarioId: "job_interview",
  level: "B1",
  correctionMode: "post_session",
  realtimeProvider: "openai",
  voice: "marin",
  sessionId: null,
  mode: "idle",
  turns: [],
  peerConnection: null,
  dataChannel: null,
  localStream: null,
  volcRtcEngine: null,
  volcRtcRoom: null,
  mediaRecorder: null,
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
  audioStrip: document.querySelector(".audio-strip"),
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
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function setStatus(status) {
  state.mode = status;
  els.statusPill.textContent = status.replaceAll("_", " ");
  els.audioStrip.classList.toggle("live", ["connected", "user_speaking", "ai_speaking", "mock"].includes(status));
  renderDiagnostics();
}

function logEvent(type, detail = "") {
  state.eventLog.unshift({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    type,
    detail,
  });
  state.eventLog = state.eventLog.slice(0, 80);
  renderEventLog();
}

function renderDiagnostics() {
  const modeParts = [state.sessionMode || "unknown"];
  modeParts.push(state.realtimeProvider);
  if (state.health?.demoMode) modeParts.push("demo");
  if (state.realtimeProvider === "openai" && !state.health?.hasOpenAIKey) modeParts.push("no-key");
  if (state.realtimeProvider === "volc_doubao" && !state.health?.volcDoubao?.ready) modeParts.push("doubao-missing-config");
  if (state.health?.hasDeepSeekKey) modeParts.push("deepseek");
  if (state.health?.hasAzureSpeech) modeParts.push("azure-speech");
  els.modeLabel.textContent = modeParts.join(" / ");
  els.sessionIdLabel.textContent = state.sessionId || "none";
  els.turnCountLabel.textContent = String(state.turns.filter((turn) => turn.speaker === "user").length);
  els.exportSessionBtn.disabled = !state.sessionId && state.turns.length === 0;
}

function renderEventLog() {
  if (!state.eventLog.length) {
    els.eventLogList.innerHTML = `<div class="event-log-row"><time>--</time><strong>idle</strong><p>No events yet</p></div>`;
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
    button.innerHTML = `<strong>${scenario.label}</strong><span>${scenario.description}</span>`;
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
  els.sessionEyebrow.textContent = `${scenario.userRole} -> ${scenario.aiRole}`;
  els.sessionTitle.textContent = scenario.title;
  els.goalList.innerHTML = scenario.goals.map((goal) => `<li>${goal}</li>`).join("");
  els.keywordList.innerHTML = scenario.keywords.map((word) => `<span class="keyword">${word}</span>`).join("");
}

function renderTurns() {
  if (!state.turns.length) {
    els.transcriptList.innerHTML = `<div class="turn assistant"><div class="turn-label">Coach</div><div>${selectedScenario()?.openingPrompt || "Choose a scenario to start."}</div></div>`;
    return;
  }

  els.transcriptList.innerHTML = state.turns.map((turn) => `
    <article class="turn ${turn.speaker}">
      <div class="turn-label">${turn.speaker === "user" ? "Learner" : "Coach"}</div>
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
    const session = await apiJson("/api/realtime/session", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: scenario.id,
        level: state.level,
        correctionMode: state.correctionMode,
        provider: state.realtimeProvider,
        voice: state.voice,
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
        setStatus("connected");
        addTurn(
          "assistant",
          session.serverStarted
            ? `${scenario.openingPrompt} (Doubao O2.0 is in the RTC room.)`
            : `${scenario.openingPrompt} (Doubao O2.0 config ready; StartVoiceChat ${session.serverStart?.status || "pending"}.)`,
          session.serverStarted ? "doubao_seed" : "mock",
        );
      } catch (error) {
        setStatus("mock");
        logEvent("doubao:fallback", error.message || "RTC SDK connection pending");
        addTurn("assistant", `${scenario.openingPrompt} (Doubao O2.0 config ready; ${error.message || "RTC SDK connection pending"}.)`, "mock");
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
}

function registerVolcRtcEventHandlers(engine, sdk, session) {
  bindVolcRtcEvent(engine, sdk, "onUserJoined", (event) => {
    logEvent("doubao:user_joined", extractVolcEventUserId(event) || "remote");
  });
  bindVolcRtcEvent(engine, sdk, "onUserLeave", (event) => {
    logEvent("doubao:user_left", extractVolcEventUserId(event) || "remote");
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
  return event?.userInfo?.userId || event?.userId || event?.uid || event?.UserId || "";
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
}

function renderReport(summary) {
  els.reportPanel.classList.remove("hidden");
  els.overallScore.textContent = summary.overallScore;
  els.overallScore.style.background = `conic-gradient(var(--teal) ${summary.overallScore}%, #edf1ed 0)`;
  els.scoreGrid.innerHTML = Object.entries(summary.scores).map(([label, value]) => `
    <div class="score-card">
      <span>${label}</span>
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
  try {
    const result = await apiJson("/api/pronunciation/scripted", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: selectedScenario().id,
        referenceText: state.pronunciationText || selectedScenario().pronunciationSentences[0],
        audioBase64: state.pronunciationAudio?.base64,
        mimeType: state.pronunciationAudio?.mimeType,
        durationMs: state.pronunciationAudio?.durationMs,
        language: "en-US",
      }),
    });
    renderPronunciationResult(result);
  } catch (error) {
    logEvent("pronunciation:error", error.message || "scoring failed");
    els.pronunciationResult.innerHTML = `<p class="audio-note">Scoring failed: ${escapeHtml(error.message || "Please try again.")}</p>`;
  }
}

function renderPronunciationResult(result) {
  state.lastPronunciationResult = result;
  const weakWords = Array.isArray(result.weakWords) ? result.weakWords : [];
  const provider = result.source || "unknown";
  const providerDetail = result.providerError
    ? `Fallback: ${result.providerError}`
    : result.audioReceived
      ? "Audio payload received by backend."
      : "No audio payload sent; mock score only.";
  logEvent("pronunciation:ready", `${provider} / score=${result.pronunciation}${result.audioReceived ? " / audio" : ""}`);
  els.pronunciationResult.innerHTML = `
    <div class="score-grid">
      ${["pronunciation", "accuracy", "fluency", "completeness", "prosody"].map((key) => `
        <div class="score-card"><span>${key}</span><strong>${result[key]}</strong></div>
      `).join("")}
    </div>
    <div>
      ${weakWords.map((item) => `
        <span class="weak-word">${escapeHtml(item.word)} ${item.score}: ${escapeHtml(item.tipZh)}</span>
      `).join("")}
    </div>
    <p>${escapeHtml(result.adviceZh)}</p>
    <p class="audio-note">Provider: ${escapeHtml(provider)}. ${escapeHtml(providerDetail)}</p>
  `;
}

async function recordPronunciation() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    await scorePronunciation();
    return;
  }
  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
    els.recordPronunciationBtn.textContent = "Record";
    return;
  }

  state.pronunciationAudio = null;
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
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) chunks.push(event.data);
  });
  recorder.addEventListener("stop", async () => {
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
    logEvent("pronunciation:recorded", `${state.pronunciationAudio.mimeType} / ${state.pronunciationAudio.sizeBytes} bytes`);
    await scorePronunciation();
  });
  recorder.start();
  logEvent("pronunciation:record", "started");
  els.recordPronunciationBtn.textContent = "Stop";
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
  els.startBtn.addEventListener("click", startPractice);
  els.endBtn.addEventListener("click", endPractice);
  els.sendMockBtn.addEventListener("click", () => {
    const value = els.mockInput.value.trim();
    if (!value) return;
    addTurn("user", value, "typed_mock");
    addTurn("assistant", mockAssistantReply(value), "mock");
    els.mockInput.value = "";
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
  state.realtimeProvider = state.health.realtimeProvider || "openai";
  if (els.realtimeProvider) els.realtimeProvider.value = state.realtimeProvider;
  state.sessionMode = realtimeReadinessLabel(state.health);
  logEvent("app:health", `${state.sessionMode} / ${state.health.realtimeModel || state.health.volcDoubao?.model || "mock"}`);
  const data = await apiJson("/api/scenarios");
  state.scenarios = data.scenarios;
  state.selectedScenarioId = state.scenarios[0].id;
  state.level = state.scenarios[0].level;
  wireEvents();
  renderAll();
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
    pronunciationResult: state.lastPronunciationResult,
    events: [...state.eventLog].reverse(),
  };
}

function realtimeReadinessLabel(health) {
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
