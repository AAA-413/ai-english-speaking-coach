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
};

const els = {
  scenarioList: document.querySelector("#scenarioList"),
  sessionEyebrow: document.querySelector("#sessionEyebrow"),
  sessionTitle: document.querySelector("#sessionTitle"),
  statusPill: document.querySelector("#statusPill"),
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
  });
  renderTurns();
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
  state.pronunciationText = scenario.pronunciationSentences[0];
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
    setStatus("mock");
    addTurn("assistant", scenario.openingPrompt, "mock");
    els.endBtn.disabled = false;
  } finally {
    els.startBtn.disabled = false;
  }
}

async function connectRealtime(clientSecret) {
  setStatus("requesting_microphone");
  const pc = new RTCPeerConnection();
  state.peerConnection = pc;

  pc.ontrack = (event) => {
    els.remoteAudio.srcObject = event.streams[0];
    setStatus("ai_speaking");
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") setStatus("connected");
    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setStatus(pc.connectionState);
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.localStream = stream;
  pc.addTrack(stream.getTracks()[0], stream);

  const dc = pc.createDataChannel("oai-events");
  state.dataChannel = dc;
  dc.addEventListener("message", (event) => handleRealtimeEvent(JSON.parse(event.data)));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

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
}

function handleRealtimeEvent(event) {
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

  renderReport(summary);
  setStatus("report_ready");
}

function cleanupRealtime() {
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
}

async function scorePronunciation() {
  const result = await apiJson("/api/pronunciation/scripted", {
    method: "POST",
    body: JSON.stringify({
      scenarioId: selectedScenario().id,
      referenceText: state.pronunciationText || selectedScenario().pronunciationSentences[0],
    }),
  });
  renderPronunciationResult(result);
}

function renderPronunciationResult(result) {
  els.pronunciationResult.innerHTML = `
    <div class="score-grid">
      ${["pronunciation", "accuracy", "fluency", "completeness", "prosody"].map((key) => `
        <div class="score-card"><span>${key}</span><strong>${result[key]}</strong></div>
      `).join("")}
    </div>
    <div>
      ${result.weakWords.map((item) => `
        <span class="weak-word">${escapeHtml(item.word)} ${item.score}: ${escapeHtml(item.tipZh)}</span>
      `).join("")}
    </div>
    <p>${escapeHtml(result.adviceZh)}</p>
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
  const recorder = new MediaRecorder(stream);
  state.mediaRecorder = recorder;
  const chunks = [];
  recorder.addEventListener("dataavailable", (event) => chunks.push(event.data));
  recorder.addEventListener("stop", async () => {
    stream.getTracks().forEach((track) => track.stop());
    await scorePronunciation();
  });
  recorder.start();
  els.recordPronunciationBtn.textContent = "Stop";
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
}

async function init() {
  const data = await apiJson("/api/scenarios");
  state.scenarios = data.scenarios;
  state.selectedScenarioId = state.scenarios[0].id;
  state.level = state.scenarios[0].level;
  wireEvents();
  renderAll();
}

init().catch((error) => {
  console.error(error);
  setStatus("error");
});
