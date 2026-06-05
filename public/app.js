const state = {
  scenarios: [],
  selectedScenarioId: "job_interview",
  level: "B1",
  correctionMode: "post_session",
  voice: "marin",
  sessionId: null,
  mode: "idle",
  turns: [],
  peerConnection: null,
  dataChannel: null,
  localStream: null,
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
  if (state.health?.demoMode) modeParts.push("demo");
  if (!state.health?.hasOpenAIKey) modeParts.push("no-key");
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
  logEvent("session:start", `${scenario.id} / ${state.level} / ${state.correctionMode}`);
  renderTurns();
  setStatus("creating_session");

  try {
    const session = await apiJson("/api/realtime/session", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: scenario.id,
        level: state.level,
        correctionMode: state.correctionMode,
        voice: state.voice,
      }),
    });
    state.sessionId = session.sessionId;
    state.sessionMode = session.mode;
    state.sessionReason = session.reason || "";
    logEvent("session:created", `${session.mode}${session.reason ? ` - ${session.reason}` : ""}`);

    if (session.mode === "realtime") {
      await connectRealtime(session.clientSecret);
      setStatus("connected");
    } else {
      setStatus("mock");
      addTurn("assistant", scenario.openingPrompt, "mock");
    }
    els.endBtn.disabled = false;
  } catch (error) {
    console.error(error);
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
  dc.addEventListener("message", (event) => handleRealtimeEvent(JSON.parse(event.data)));

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

function cleanupRealtime() {
  if (state.peerConnection || state.localStream) logEvent("webrtc:cleanup", "closing local media and peer connection");
  state.dataChannel?.close();
  state.peerConnection?.close();
  state.localStream?.getTracks().forEach((track) => track.stop());
  state.dataChannel = null;
  state.peerConnection = null;
  state.localStream = null;
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

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferredMimeType = choosePronunciationMimeType();
  const recorder = preferredMimeType
    ? new MediaRecorder(stream, { mimeType: preferredMimeType })
    : new MediaRecorder(stream);
  state.mediaRecorder = recorder;
  const startedAt = performance.now();
  const chunks = [];
  recorder.addEventListener("dataavailable", (event) => chunks.push(event.data));
  recorder.addEventListener("stop", async () => {
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
  state.sessionMode = state.health.hasOpenAIKey ? "realtime-ready" : "mock-ready";
  logEvent("app:health", state.health.hasOpenAIKey ? state.health.realtimeModel : "mock mode");
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
      voice: state.voice,
      realtimeModel: state.health?.realtimeModel,
      transcribeModel: state.health?.transcribeModel,
    },
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
