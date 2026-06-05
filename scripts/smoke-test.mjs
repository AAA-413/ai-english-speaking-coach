const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${text}`);
  }

  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await request("/api/health");
assert(health.ok === true, "Health check did not return ok");

const scenarioResponse = await request("/api/scenarios");
assert(Array.isArray(scenarioResponse.scenarios), "Scenarios response is missing scenarios array");
assert(scenarioResponse.scenarios.length >= 3, "Expected at least three scenarios");

const realtimeSession = await request("/api/realtime/session", {
  method: "POST",
  body: JSON.stringify({
    scenarioId: "job_interview",
    level: "B1",
    correctionMode: "post_session",
  }),
});
assert(realtimeSession.sessionId, "Realtime session response is missing sessionId");
assert(["mock", "realtime", "volc_doubao_setup"].includes(realtimeSession.mode), "Realtime session mode is invalid");

const summary = await request("/api/sessions/smoke/summary", {
  method: "POST",
  body: JSON.stringify({
    scenarioId: "job_interview",
    level: "B1",
    turns: [
      {
        id: "turn_1",
        speaker: "user",
        sequence: 1,
        transcript: "I am work as product manager for three years.",
      },
    ],
  }),
});
assert(summary.overallScore >= 0, "Summary is missing overallScore");
assert(summary.scores?.grammar >= 0, "Summary is missing grammar score");
assert(Array.isArray(summary.corrections) && summary.corrections.length > 0, "Summary is missing corrections");

const pronunciation = await request("/api/pronunciation/scripted", {
  method: "POST",
  body: JSON.stringify({
    scenarioId: "restaurant_ordering",
    referenceText: "Could I get a medium latte with oat milk, please?",
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=",
    mimeType: "audio/wav",
    durationMs: 100,
  }),
});
assert(pronunciation.pronunciation >= 0, "Pronunciation response is missing score");
assert(Array.isArray(pronunciation.weakWords), "Pronunciation response is missing weakWords");
assert(pronunciation.audioReceived === true, "Pronunciation response did not acknowledge audio payload");

const transcription = await request("/api/sessions/smoke/transcribe", {
  method: "POST",
  body: JSON.stringify({
    turnId: "turn_audio",
    roughTranscript: "Could I get a medium latte please?",
    audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=",
    mimeType: "audio/wav",
  }),
});
assert(transcription.transcript, "Transcription response is missing transcript");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  scenarios: scenarioResponse.scenarios.length,
  realtimeMode: realtimeSession.mode,
  summaryScore: summary.overallScore,
  pronunciationScore: pronunciation.pronunciation,
  transcriptionSource: transcription.source,
}, null, 2));
