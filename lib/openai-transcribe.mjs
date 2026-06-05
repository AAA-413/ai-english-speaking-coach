export async function transcribeAudio({ audioBase64, mimeType, fileName, language = "en" }) {
  if (!audioBase64) throw new Error("audioBase64 is required");

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const bytes = Buffer.from(stripDataUrlPrefix(audioBase64), "base64");
  if (!bytes.length) throw new Error("audioBase64 did not decode to audio bytes");

  const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
  const form = new FormData();
  form.append("model", model);
  form.append("file", blob, fileName || defaultFileName(mimeType));
  form.append("language", language);
  form.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI transcription failed with ${response.status}`);
  }

  return {
    transcript: payload.text || "",
    confidence: payload.confidence ?? null,
    source: "openai_transcribe",
    model,
  };
}

function stripDataUrlPrefix(value) {
  return String(value).replace(/^data:[^;]+;base64,/, "");
}

function defaultFileName(mimeType) {
  if (mimeType?.includes("mp4")) return "audio.mp4";
  if (mimeType?.includes("mpeg")) return "audio.mp3";
  if (mimeType?.includes("wav")) return "audio.wav";
  if (mimeType?.includes("ogg")) return "audio.ogg";
  return "audio.webm";
}
