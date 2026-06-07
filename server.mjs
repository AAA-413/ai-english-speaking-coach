import http from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { scenarios, getScenario } from "./lib/scenarios.mjs";
import {
  createMockSummary,
  mockTranscript,
} from "./lib/mock-analysis.mjs";
import { assessAzurePronunciation } from "./lib/azure-pronunciation.mjs";
import { assessScriptedPronunciation } from "./lib/scripted-pronunciation.mjs";
import { createSummary } from "./lib/openai-summary.mjs";
import { transcribeAudio } from "./lib/openai-transcribe.mjs";
import { createRealtimeClientSecret } from "./lib/realtime-session.mjs";
import {
  createVolcDoubaoRealtimeSession,
  startVolcDoubaoVoiceChat,
  stopVolcDoubaoVoiceChat,
  volcDoubaoHealth,
} from "./lib/volc-doubao-realtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const execFileAsync = promisify(execFile);

loadEnvFile(path.join(__dirname, ".env"));

const port = Number(process.env.PORT || 3000);
const clientEvents = [];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function createSessionId() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/client-events") {
    sendJson(res, 200, {
      events: clientEvents.slice(-120),
    });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/client-events") {
    clientEvents.length = 0;
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/client-events") {
    const body = await readJson(req);
    clientEvents.push({
      at: new Date().toISOString(),
      sessionId: body.sessionId || null,
      mode: body.mode || null,
      provider: body.provider || null,
      type: String(body.type || "client:event").slice(0, 120),
      detail: String(body.detail || "").slice(0, 500),
      status: body.status || null,
    });
    if (clientEvents.length > 500) clientEvents.splice(0, clientEvents.length - 500);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      demoMode: process.env.DEMO_MODE === "true",
      hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
      realtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2",
      transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      textModel: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      deepSeekTextModel: process.env.DEEPSEEK_TEXT_MODEL || "deepseek-chat",
      realtimeProvider: process.env.REALTIME_PROVIDER || "openai",
      realtimeVoice: process.env.OPENAI_REALTIME_VOICE || "marin",
      useMockAnalysis: shouldUseMockAnalysis(),
      hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY),
      hasAzureSpeech: Boolean(process.env.AZURE_SPEECH_KEY && (process.env.AZURE_SPEECH_ENDPOINT || process.env.AZURE_SPEECH_REGION)),
      volcDoubao: volcDoubaoHealth(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/scenarios") {
    sendJson(res, 200, { scenarios });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tts") {
    const body = await readJson(req);
    const text = String(body.text || "").trim();
    if (!text) {
      sendJson(res, 400, { error: "Missing text" });
      return;
    }
    try {
      sendJson(res, 200, await createLocalSpeechAudio({ text }));
    } catch (error) {
      sendJson(res, 500, {
        error: "Local TTS failed",
        detail: error.message || "Unable to generate speech audio",
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/dialogue/reply") {
    const body = await readJson(req);
    const scenario = getScenario(body.scenarioId) || scenarios[0];
    const turns = Array.isArray(body.turns) ? body.turns : [];
    const userText = String(body.userText || "").trim();
    if (!userText) {
      sendJson(res, 200, {
        source: "empty",
        reply: scenario.followUpQuestions?.[0] || scenario.openingPrompt,
      });
      return;
    }
    try {
      sendJson(res, 200, await createDialogueReply({
        scenario,
        level: body.level || scenario.level,
        turns,
        userText,
      }));
    } catch (error) {
      sendJson(res, 200, {
        source: "fallback",
        providerError: error.message || "Dialogue reply failed",
        reply: fallbackDialogueReply({ scenario, userText, turns }),
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/realtime/session") {
    const body = await readJson(req);
    const scenario = getScenario(body.scenarioId) || scenarios[0];
    const sessionId = body.sessionId || createSessionId();
    const provider = body.provider || process.env.REALTIME_PROVIDER || "openai";

    if (provider === "mock") {
      sendJson(res, 200, {
        mode: "mock",
        provider,
        sessionId,
        reason: "Mock realtime provider selected",
        scenario,
      });
      return;
    }

    if (provider === "volc_doubao") {
      if (process.env.DEMO_MODE === "true") {
        sendJson(res, 200, {
          mode: "mock",
          provider,
          sessionId,
          reason: "DEMO_MODE enabled",
          scenario,
        });
        return;
      }

      try {
        const volcSession = createVolcDoubaoRealtimeSession({
          scenario,
          level: body.level || scenario.level,
          correctionMode: body.correctionMode || "post_session",
          sessionId,
        });
        const serverStart = body.deferServerStart
          ? {
            ok: false,
            status: "deferred",
            message: "StartVoiceChat will run after the browser joins the RTC room.",
          }
          : await startVolcDoubaoVoiceChat({
            session: volcSession,
          });

        sendJson(res, 200, {
          mode: "volc_doubao_setup",
          provider,
          sessionId,
          reason: serverStart.ok
            ? "Volc Doubao O2.0 StartVoiceChat started; browser should join the same RTC room."
            : serverStart.status === "deferred"
              ? "Volc Doubao O2.0 config is ready; browser will start the agent after RTC join."
              : `Volc Doubao O2.0 config is ready; StartVoiceChat ${serverStart.status}.`,
          scenario,
          model: volcSession.model,
          rtcAppId: volcSession.rtcAppId,
          clientToken: volcSession.clientToken,
          sdkUrl: volcSession.sdkUrl,
          sdkSource: volcSession.sdkSource,
          sdkVersion: volcSession.sdkVersion,
          roomId: volcSession.roomId,
          taskId: volcSession.taskId,
          userId: volcSession.userId,
          agentUserId: volcSession.agentUserId,
          serverStartRequired: true,
          serverStart,
          serverStarted: Boolean(serverStart.ok),
          clientJoinReady: Boolean(volcSession.clientToken),
          s2sConfigPreview: redactVolcDoubaoPayload(volcSession.startVoiceChatPayload),
        });
        return;
      } catch (error) {
        sendJson(res, 200, {
          mode: "mock",
          provider,
          sessionId,
          reason: error.message || "Volc Doubao realtime config is incomplete",
          scenario,
        });
        return;
      }
    }

    if (process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY) {
      sendJson(res, 200, {
        mode: "mock",
        provider,
        sessionId,
        reason: process.env.OPENAI_API_KEY ? "DEMO_MODE enabled" : "OPENAI_API_KEY is not configured",
        scenario,
      });
      return;
    }

    try {
      const result = await createRealtimeClientSecret({
        scenario,
        level: body.level || scenario.level,
        correctionMode: body.correctionMode || "post_session",
        voice: body.voice || process.env.OPENAI_REALTIME_VOICE || "marin",
        sessionId,
      });

      sendJson(res, 200, {
        mode: "realtime",
        provider,
        sessionId,
        model: result.model,
        clientSecret: result.clientSecret,
        expiresAt: result.expiresAt,
        scenario,
      });
    } catch (error) {
      sendJson(res, 200, {
        mode: "mock",
        provider,
        sessionId,
        reason: error.message || "Realtime session creation failed",
        scenario,
      });
    }
    return;
  }

  const realtimeStartMatch = url.pathname.match(/^\/api\/realtime\/session\/([^/]+)\/start$/);
  if (req.method === "POST" && realtimeStartMatch) {
    const body = await readJson(req);
    const scenario = getScenario(body.scenarioId) || scenarios[0];
    const sessionId = realtimeStartMatch[1];
    try {
      const volcSession = createVolcDoubaoRealtimeSession({
        scenario,
        level: body.level || scenario.level,
        correctionMode: body.correctionMode || "post_session",
        sessionId,
      });
      const serverStart = await startVolcDoubaoVoiceChat({
        session: volcSession,
      });
      sendJson(res, 200, {
        provider: "volc_doubao",
        sessionId,
        roomId: volcSession.roomId,
        taskId: volcSession.taskId,
        userId: volcSession.userId,
        agentUserId: volcSession.agentUserId,
        serverStart,
        serverStarted: Boolean(serverStart.ok),
      });
    } catch (error) {
      sendJson(res, 200, {
        provider: "volc_doubao",
        sessionId,
        serverStarted: false,
        serverStart: {
          ok: false,
          status: "error",
          message: error.message || "StartVoiceChat failed",
        },
      });
    }
    return;
  }

  const realtimeStopMatch = url.pathname.match(/^\/api\/realtime\/session\/([^/]+)\/stop$/);
  if (req.method === "POST" && realtimeStopMatch) {
    const body = await readJson(req);
    const result = await stopVolcDoubaoVoiceChat({
      roomId: body.roomId,
      taskId: body.taskId,
    });
    sendJson(res, 200, {
      provider: "volc_doubao",
      sessionId: realtimeStopMatch[1],
      ...result,
    });
    return;
  }

  const summaryMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/summary$/);
  if (req.method === "POST" && summaryMatch) {
    const body = await readJson(req);
    const scenario = getScenario(body.scenarioId) || scenarios[0];
    const summaryInput = {
      sessionId: summaryMatch[1],
      scenario,
      level: body.level || scenario.level,
      turns: Array.isArray(body.turns) ? body.turns : [],
    };

    if (!shouldUseMockAnalysis()) {
      try {
        sendJson(res, 200, await createSummary(summaryInput));
        return;
      } catch (error) {
        const summary = createMockSummary(summaryInput);
        summary.providerError = error.message || "OpenAI summary failed";
        sendJson(res, 200, summary);
        return;
      }
    }

    sendJson(res, 200, createMockSummary(summaryInput));
    return;
  }

  const transcribeMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/transcribe$/);
  if (req.method === "POST" && transcribeMatch) {
    const body = await readJson(req);
    if (!shouldUseMockAnalysis() && body.audioBase64) {
      try {
        const result = await transcribeAudio({
          audioBase64: body.audioBase64,
          mimeType: body.mimeType,
          fileName: body.fileName,
          language: body.language || "en",
        });
        sendJson(res, 200, {
          sessionId: transcribeMatch[1],
          turnId: body.turnId || `turn_${Date.now()}`,
          ...result,
        });
        return;
      } catch (error) {
        sendJson(res, 200, {
          sessionId: transcribeMatch[1],
          turnId: body.turnId || `turn_${Date.now()}`,
          transcript: body.roughTranscript || mockTranscript(body.referenceText),
          confidence: 0.5,
          source: body.roughTranscript ? "rough_transcript" : "mock",
          providerError: error.message || "OpenAI transcription failed",
        });
        return;
      }
    }

    sendJson(res, 200, {
      sessionId: transcribeMatch[1],
      turnId: body.turnId || `turn_${Date.now()}`,
      transcript: body.roughTranscript || mockTranscript(body.referenceText),
      confidence: 0.86,
      source: body.roughTranscript ? "rough_transcript" : "mock",
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/pronunciation/scripted") {
    const body = await readJson(req);
    if (!shouldUseMockPronunciation() && body.audioBase64) {
      try {
        sendJson(res, 200, {
          scenarioId: body.scenarioId,
          referenceText: body.referenceText,
          audioReceived: true,
          mimeType: body.mimeType || null,
          durationMs: body.durationMs || null,
          ...(await assessAzurePronunciation({
            referenceText: body.referenceText,
            audioBase64: body.audioBase64,
            mimeType: body.mimeType,
            durationMs: body.durationMs,
            language: body.language || "en-US",
          })),
        });
        return;
      } catch (error) {
        sendJson(res, 200, {
          scenarioId: body.scenarioId,
          referenceText: body.referenceText,
          audioReceived: true,
          mimeType: body.mimeType || null,
          durationMs: body.durationMs || null,
          recognizedTranscript: body.recognizedTranscript || "",
          ...(assessScriptedPronunciation({
            referenceText: body.referenceText,
            recognizedTranscript: body.recognizedTranscript,
            durationMs: body.durationMs,
            audioReceived: true,
            providerError: error.message || "Azure pronunciation failed",
          })),
        });
        return;
      }
    }

    sendJson(res, 200, {
      scenarioId: body.scenarioId,
      referenceText: body.referenceText,
      audioReceived: Boolean(body.audioBase64),
      mimeType: body.mimeType || null,
      durationMs: body.durationMs || null,
      recognizedTranscript: body.recognizedTranscript || "",
      ...(assessScriptedPronunciation({
        referenceText: body.referenceText,
        recognizedTranscript: body.recognizedTranscript,
        durationMs: body.durationMs,
        audioReceived: Boolean(body.audioBase64),
      })),
    });
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

function redactVolcDoubaoPayload(payload) {
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

function shouldUseMockAnalysis() {
  return process.env.DEMO_MODE === "true"
    || process.env.USE_MOCK_ANALYSIS === "true"
    || !(process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY);
}

function shouldUseMockPronunciation() {
  return process.env.DEMO_MODE === "true"
    || process.env.USE_MOCK_PRONUNCIATION === "true"
    || !process.env.AZURE_SPEECH_KEY
    || !(process.env.AZURE_SPEECH_ENDPOINT || process.env.AZURE_SPEECH_REGION);
}

async function createDialogueReply({
  scenario,
  level,
  turns,
  userText,
  env = process.env,
  fetchImpl = fetch,
}) {
  if (!env.DEEPSEEK_API_KEY) {
    return {
      source: "local_fallback",
      reply: fallbackDialogueReply({ scenario, userText, turns }),
    };
  }

  const baseUrl = (env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = env.DEEPSEEK_DIALOGUE_MODEL || "deepseek-chat";
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_tokens: 140,
      messages: [
        {
          role: "system",
          content: [
            "You are an English speaking coach in a live voice role-play.",
            `Scenario: ${scenario.title}.`,
            `You play the role of ${scenario.aiRole}; the learner is the ${scenario.userRole}.`,
            `Learner level: ${level || scenario.level}.`,
            "Reply only in natural English.",
            "Keep the reply short: one or two sentences.",
            "Ask exactly one follow-up question.",
            "Do not give long grammar explanations during live conversation.",
          ].join("\n"),
        },
        ...turns.slice(-6).map((turn) => ({
          role: turn.speaker === "assistant" ? "assistant" : "user",
          content: String(turn.transcript || "").slice(0, 500),
        })),
        {
          role: "user",
          content: userText,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `DeepSeek dialogue failed with ${response.status}`);
  }

  const reply = payload?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("DeepSeek dialogue returned empty reply");
  return {
    source: "deepseek_dialogue",
    model,
    reply: reply.replace(/\s+/g, " ").slice(0, 500),
  };
}

function fallbackDialogueReply({ scenario, userText, turns }) {
  if (scenario.id === "restaurant_ordering") {
    if (/latte|coffee|tea|drink/i.test(userText)) return "Sure. Would you like that hot or iced?";
    return "Of course. What size would you like?";
  }
  if (scenario.id === "business_meeting") {
    return "Thanks for the update. What is the biggest blocker we should resolve first?";
  }
  if (/project|product|manager|work/i.test(userText)) {
    return "Good. What was your specific impact in that project?";
  }
  return scenario.followUpQuestions?.[turns.length % Math.max(1, scenario.followUpQuestions.length)]
    || "Could you give me one specific example?";
}

async function createLocalSpeechAudio({ text, env = process.env }) {
  const spokenText = String(text).replace(/\s+/g, " ").slice(0, 700);
  const voice = env.MACOS_TTS_VOICE || "Samantha";
  const dir = await mkdtemp(path.join(tmpdir(), "english-coach-tts-"));
  const aiffPath = path.join(dir, "speech.aiff");
  const m4aPath = path.join(dir, "speech.m4a");

  try {
    await execFileAsync("/usr/bin/say", ["-v", voice, "-o", aiffPath, spokenText], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
    await execFileAsync("/usr/bin/afconvert", ["-f", "m4af", "-d", "aac", aiffPath, m4aPath], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    });
    const audio = await readFile(m4aPath);
    return {
      source: "macos_say",
      voice,
      mimeType: "audio/mp4",
      audioBase64: audio.toString("base64"),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function serveStatic(req, res, url) {
  const safePath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    const fallback = path.join(publicDir, "index.html");
    const html = await readFile(fallback);
    sendText(res, 200, html, contentTypes[".html"]);
    return;
  }

  const ext = path.extname(filePath);
  const body = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, {
      error: "Internal server error",
      detail: error.message,
    });
  }
});

server.listen(port, () => {
  console.log(`AI English Speaking Coach running at http://localhost:${port}`);
});
