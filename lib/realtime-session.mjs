import { buildRealtimeInstructions } from "./scenarios.mjs";

export async function createRealtimeClientSecret({
  scenario,
  level,
  correctionMode,
  voice,
  sessionId,
}) {
  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
  const transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const instructions = buildRealtimeInstructions({ scenario, level, correctionMode });

  const sessionConfig = {
    session: {
      type: "realtime",
      model,
      instructions,
      audio: {
        input: {
          transcription: {
            model: transcribeModel,
            language: "en",
            prompt: `English speaking practice about ${scenario.title}. Expect learner mistakes and scenario vocabulary: ${scenario.keywords.join(", ")}.`,
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: scenario.id === "restaurant_ordering" ? 450 : 700,
          },
        },
        output: {
          voice,
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `demo-${sessionId}`,
    },
    body: JSON.stringify(sessionConfig),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `OpenAI Realtime returned ${response.status}`;
    throw new Error(message);
  }

  const clientSecret = data.value || data.client_secret?.value;
  if (!clientSecret) {
    throw new Error("OpenAI Realtime response did not include a client secret");
  }

  return {
    model,
    clientSecret,
    expiresAt: data.expires_at || data.client_secret?.expires_at || null,
  };
}
