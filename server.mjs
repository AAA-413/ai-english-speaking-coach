import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios, getScenario } from "./lib/scenarios.mjs";
import {
  createMockPronunciationAssessment,
  createMockSummary,
  mockTranscript,
} from "./lib/mock-analysis.mjs";
import { createOpenAISummary } from "./lib/openai-summary.mjs";
import { createRealtimeClientSecret } from "./lib/realtime-session.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

loadEnvFile(path.join(__dirname, ".env"));

const port = Number(process.env.PORT || 3000);

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
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      demoMode: process.env.DEMO_MODE === "true",
      hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
      realtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2",
      transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      textModel: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      realtimeVoice: process.env.OPENAI_REALTIME_VOICE || "marin",
      useMockAnalysis: shouldUseMockAnalysis(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/scenarios") {
    sendJson(res, 200, { scenarios });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/realtime/session") {
    const body = await readJson(req);
    const scenario = getScenario(body.scenarioId) || scenarios[0];
    const sessionId = body.sessionId || createSessionId();

    if (process.env.DEMO_MODE === "true" || !process.env.OPENAI_API_KEY) {
      sendJson(res, 200, {
        mode: "mock",
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
        sessionId,
        model: result.model,
        clientSecret: result.clientSecret,
        expiresAt: result.expiresAt,
        scenario,
      });
    } catch (error) {
      sendJson(res, 200, {
        mode: "mock",
        sessionId,
        reason: error.message || "Realtime session creation failed",
        scenario,
      });
    }
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
        sendJson(res, 200, await createOpenAISummary(summaryInput));
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
    sendJson(res, 200, createMockPronunciationAssessment({
      referenceText: body.referenceText,
      scenarioId: body.scenarioId,
    }));
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

function shouldUseMockAnalysis() {
  return process.env.DEMO_MODE === "true"
    || process.env.USE_MOCK_ANALYSIS === "true"
    || !process.env.OPENAI_API_KEY;
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
