"use client";

import { useMemo, useRef, useState } from "react";
import { scenarios } from "@/shared/scenarios";
import type {
  CorrectionMode,
  EnglishLevel,
  EventLogEntry,
  HealthResponse,
  PracticeStatus,
  PracticeTurn,
  PronunciationAssessment,
  RealtimeProvider,
  RealtimeSessionResponse,
  ScenarioId,
  SessionSummary,
} from "@/shared/practice";
import {
  createRealtimeSession,
  createSessionSummary,
  getHealth,
  scorePronunciation,
} from "@/lib/api-client";
import { buildSessionSnapshot, downloadSessionSnapshot } from "@/lib/session-export";
import { usePronunciationRecorder } from "./usePronunciationRecorder";

type RealtimeEventPayload = {
  type?: string;
  transcript?: string;
  item?: {
    role?: string;
    content?: Array<{ transcript?: string; text?: string }>;
  };
  response?: {
    output?: Array<{
      content?: Array<{ transcript?: string; text?: string }>;
    }>;
  };
};

declare global {
  interface Window {
    VERTC?: {
      createEngine?: (appId: string) => any;
      default?: {
        createEngine?: (appId: string) => any;
      };
    };
  }
}

export function usePracticeSession() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>("job_interview");
  const [level, setLevel] = useState<EnglishLevel>("B1");
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("post_session");
  const [realtimeProvider, setRealtimeProvider] = useState<RealtimeProvider>("openai");
  const [voice, setVoice] = useState("marin");
  const [status, setStatus] = useState<PracticeStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [turns, setTurns] = useState<PracticeTurn[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [pronunciationText, setPronunciationText] = useState("");
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationAssessment | null>(null);
  const [lastRealtimeSetup, setLastRealtimeSetup] = useState<RealtimeSessionResponse | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const volcRtcEngineRef = useRef<any>(null);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) || scenarios[0],
    [selectedScenarioId],
  );

  const pronunciationRecorder = usePronunciationRecorder(addEvent);

  async function refreshHealth() {
    const nextHealth = await getHealth();
    setHealth(nextHealth);
    setRealtimeProvider(nextHealth.realtimeProvider || "openai");
    setVoice(nextHealth.realtimeVoice || "marin");
    addEvent("app:health", `${nextHealth.realtimeProvider} / ${nextHealth.realtimeModel || nextHealth.volcDoubao.model}`);
  }

  function addEvent(type: string, detail = "") {
    setEventLog((current) => [{
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      type,
      detail,
    }, ...current].slice(0, 80));
  }

  function selectScenario(id: ScenarioId) {
    const scenario = scenarios.find((item) => item.id === id) || scenarios[0];
    setSelectedScenarioId(id);
    setLevel(scenario.level);
    setStatus("idle");
    setTurns([]);
    setSummary(null);
    setPronunciationResult(null);
    setPronunciationText(scenario.pronunciationSentences[0]);
  }

  function addTurn(speaker: PracticeTurn["speaker"], transcript: string, source: PracticeTurn["source"] = "mock") {
    const cleaned = transcript.trim();
    if (!cleaned) return;
    setTurns((current) => {
      const nextTurn = {
        id: `turn_${current.length + 1}_${Date.now().toString(36)}`,
        speaker,
        sequence: current.length + 1,
        transcript: cleaned,
        source,
        startedAt: new Date().toISOString(),
      };
      return [...current, nextTurn];
    });
    addEvent(`turn:${speaker}`, `${source}: ${cleaned.slice(0, 120)}`);
  }

  async function startPractice() {
    cleanupRealtime();
    setStatus("starting");
    setSummary(null);
    setPronunciationResult(null);
    setTurns([]);
    setEndedAt(null);
    const now = new Date().toISOString();
    setStartedAt(now);
    setPronunciationText(selectedScenario.pronunciationSentences[0]);
    addEvent("session:start", `${selectedScenario.id} / ${level} / ${correctionMode} / ${realtimeProvider}`);

    const session = await createRealtimeSession({
      scenarioId: selectedScenario.id,
      level,
      correctionMode,
      voice,
      provider: realtimeProvider,
    });
    setSessionId(session.sessionId);
    setLastRealtimeSetup(session);
    addEvent("session:created", `${session.mode}${session.reason ? ` - ${session.reason}` : ""}`);

    if (session.mode === "realtime" && session.clientSecret) {
      try {
        await connectOpenAIRealtime(session.clientSecret);
        setStatus("connected");
      } catch (error) {
        setStatus("mock");
        addEvent("realtime:fallback", error instanceof Error ? error.message : "OpenAI WebRTC connection failed");
        addTurn("assistant", selectedScenario.openingPrompt, "mock");
      }
      return;
    }

    if (session.mode === "volc_doubao_setup") {
      try {
        await connectVolcDoubaoRealtime(session);
        setStatus("connected");
        addTurn("assistant", `${selectedScenario.openingPrompt} (Doubao O2.0 RTC room joined.)`, "volc_doubao");
      } catch (error) {
        setStatus("mock");
        addEvent("doubao:fallback", error instanceof Error ? error.message : "RTC SDK connection pending");
        addTurn("assistant", `${selectedScenario.openingPrompt} (Doubao config ready; using typed practice fallback.)`, "mock");
      }
      return;
    }

    setStatus("mock");
    addTurn("assistant", selectedScenario.openingPrompt, "mock");
  }

  async function connectOpenAIRealtime(clientSecret: string) {
    addEvent("webrtc:microphone", "requesting permission");
    const pc = new RTCPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnectionRef.current = pc;
    localStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.addEventListener("track", (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
      addEvent("webrtc:track", "remote audio track received");
    });
    pc.addEventListener("connectionstatechange", () => {
      addEvent("webrtc:state", pc.connectionState);
    });
    const dc = pc.createDataChannel("oai-events");
    dataChannelRef.current = dc;
    dc.addEventListener("open", () => addEvent("realtime:data_channel", "open"));
    dc.addEventListener("close", () => addEvent("realtime:data_channel", "closed"));
    dc.addEventListener("message", (event) => {
      try {
        handleRealtimeEvent(JSON.parse(event.data) as RealtimeEventPayload);
      } catch (error) {
        addEvent("realtime:event_error", error instanceof Error ? error.message : "Unable to parse event");
      }
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });
    if (!response.ok) throw new Error(`Realtime WebRTC answer failed: ${response.status}`);
    await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    addEvent("webrtc:sdp", "remote answer applied");
  }

  async function connectVolcDoubaoRealtime(session: RealtimeSessionResponse) {
    if (!session.clientToken) throw new Error("missing VOLC_RTC_CLIENT_TOKEN");
    if (!session.rtcAppId || !session.roomId || !session.userId) throw new Error("missing RTC join parameters");
    addEvent("doubao:rtc", "requesting microphone permission");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    const sdk = await loadVolcRtcSdk(session.sdkUrl);
    const createEngine = sdk?.createEngine || sdk?.default?.createEngine;
    if (typeof createEngine !== "function") throw new Error("Volc RTC SDK createEngine is unavailable");
    const engine = createEngine(session.rtcAppId);
    volcRtcEngineRef.current = engine;
    if (typeof engine.startAudioCapture === "function") await engine.startAudioCapture();
    if (typeof engine.joinRoom !== "function") throw new Error("Volc RTC SDK joinRoom is unavailable");
    await engine.joinRoom(session.clientToken, session.roomId, { userId: session.userId }, {
      isAutoPublish: true,
      isAutoSubscribeAudio: true,
      isAutoSubscribeVideo: false,
    });
    addEvent("doubao:rtc", `joined room ${session.roomId}`);
  }

  async function loadVolcRtcSdk(sdkUrl?: string) {
    if (window.VERTC) return window.VERTC;
    if (!sdkUrl) throw new Error("missing VOLC_RTC_WEB_SDK_URL or window.VERTC");
    await new Promise<void>((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.src === sdkUrl);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = sdkUrl;
      script.async = true;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error("failed to load Volc RTC SDK")), { once: true });
      document.head.append(script);
    });
    if (!window.VERTC) throw new Error("Volc RTC SDK did not register window.VERTC");
    return window.VERTC;
  }

  function handleRealtimeEvent(event: RealtimeEventPayload) {
    addEvent("realtime:event", event.type || "unknown");
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
      addTurn("user", event.transcript, "openai_transcribe");
    }
    if (event.type === "response.audio_transcript.done" && event.transcript) {
      addTurn("assistant", event.transcript, "openai_responses");
    }
    if (event.type === "input_audio_buffer.speech_started") setStatus("user_speaking");
    if (event.type === "response.audio.delta") setStatus("ai_speaking");
    if (event.type === "response.done") setStatus("connected");
  }

  function sendTypedTurn(value: string) {
    const transcript = value.trim();
    if (!transcript) return;
    addTurn("user", transcript, "rough_transcript");
    addTurn("assistant", mockAssistantReply(transcript), "mock");
  }

  async function endPractice() {
    setStatus("ending");
    cleanupRealtime();
    const ended = new Date().toISOString();
    setEndedAt(ended);
    addEvent("session:end", `turns=${turns.length}`);
    const nextSummary = await createSessionSummary({
      sessionId: sessionId || "mock",
      scenarioId: selectedScenario.id,
      level,
      turns,
    });
    setSummary(nextSummary);
    setPronunciationText(nextSummary.recommendedPronunciationText || selectedScenario.pronunciationSentences[0]);
    setStatus("report_ready");
    addEvent("summary:ready", `score=${nextSummary.overallScore}`);
  }

  async function scoreCurrentPronunciation() {
    const result = await scorePronunciation({
      scenarioId: selectedScenario.id,
      referenceText: pronunciationText || selectedScenario.pronunciationSentences[0],
      audioBase64: pronunciationRecorder.audio?.base64,
      mimeType: pronunciationRecorder.audio?.mimeType,
      durationMs: pronunciationRecorder.audio?.durationMs,
    });
    setPronunciationResult(result);
    addEvent("pronunciation:ready", `${result.source} / score=${result.pronunciation}`);
  }

  function exportSessionJson() {
    const snapshot = buildSessionSnapshot({
      scenario: selectedScenario,
      sessionId,
      status,
      startedAt,
      endedAt,
      realtimeProvider,
      level,
      correctionMode,
      voice,
      turns,
      eventLog,
      summary,
      pronunciationText,
      pronunciationAudio: pronunciationRecorder.audio,
      pronunciationResult,
    });
    downloadSessionSnapshot(snapshot);
    addEvent("session:export", snapshot.session.id || "session");
  }

  function cleanupRealtime() {
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      volcRtcEngineRef.current?.leaveRoom?.();
      volcRtcEngineRef.current?.destroyEngine?.();
      volcRtcEngineRef.current?.destroy?.();
    } catch (error) {
      addEvent("doubao:cleanup_error", error instanceof Error ? error.message : "cleanup failed");
    }
    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    volcRtcEngineRef.current = null;
  }

  return {
    health,
    scenarios,
    selectedScenario,
    selectedScenarioId,
    level,
    correctionMode,
    realtimeProvider,
    voice,
    status,
    sessionId,
    startedAt,
    endedAt,
    turns,
    eventLog,
    summary,
    pronunciationText,
    pronunciationAudio: pronunciationRecorder.audio,
    isRecordingPronunciation: pronunciationRecorder.isRecording,
    pronunciationResult,
    lastRealtimeSetup,
    remoteAudioRef,
    refreshHealth,
    selectScenario,
    setLevel,
    setCorrectionMode,
    setRealtimeProvider,
    setVoice,
    startPractice,
    endPractice,
    sendTypedTurn,
    togglePronunciationRecording: pronunciationRecorder.toggleRecording,
    scoreCurrentPronunciation,
    exportSessionJson,
  };
}

function mockAssistantReply(userText: string) {
  if (/interview|product|manager|work|project/i.test(userText)) {
    return "Thanks. What was the hardest trade-off in that project?";
  }
  if (/latte|coffee|milk|drink|order/i.test(userText)) {
    return "Sure. Would you like that hot or iced?";
  }
  if (/meeting|timeline|blocker|delay|design/i.test(userText)) {
    return "What support do you need from the team to move this forward?";
  }
  return "Good. Can you add one more detail and say it again naturally?";
}
