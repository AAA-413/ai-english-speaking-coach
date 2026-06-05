export async function assessAzurePronunciation({
  referenceText,
  audioBase64,
  mimeType,
  durationMs,
  language = "en-US",
}) {
  if (!process.env.AZURE_SPEECH_KEY) throw new Error("AZURE_SPEECH_KEY is not configured");
  if (!audioBase64) throw new Error("audioBase64 is required for Azure pronunciation assessment");
  if (durationMs && durationMs > 30000) {
    throw new Error("Azure pronunciation REST assessment expects audio no longer than 30 seconds");
  }

  const endpoint = buildEndpoint(language);
  const contentType = azureContentType(mimeType);
  const pronunciationHeader = Buffer.from(JSON.stringify({
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Word",
    Dimension: "Comprehensive",
    EnableMiscue: "True",
    EnableProsodyAssessment: "True",
  }), "utf8").toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      Accept: "application/json",
      "Content-Type": contentType,
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
      "Pronunciation-Assessment": pronunciationHeader,
    },
    body: Buffer.from(stripDataUrlPrefix(audioBase64), "base64"),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.DisplayText || payload?.message || `Azure pronunciation failed with ${response.status}`);
  }

  return normalizeAzurePronunciation(payload);
}

function buildEndpoint(language) {
  const base = process.env.AZURE_SPEECH_ENDPOINT
    || (process.env.AZURE_SPEECH_REGION
      ? `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com`
      : null);

  if (!base) {
    throw new Error("Set AZURE_SPEECH_ENDPOINT or AZURE_SPEECH_REGION");
  }

  const url = new URL("/speech/recognition/conversation/cognitiveservices/v1", base);
  url.searchParams.set("language", language);
  url.searchParams.set("format", "detailed");
  return url.toString();
}

function azureContentType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("wav")) return "audio/wav; codecs=audio/pcm; samplerate=16000";
  if (normalized.includes("ogg")) return "audio/ogg; codecs=opus";
  throw new Error("Azure REST pronunciation supports WAV PCM or OGG OPUS audio. Browser WebM recordings fall back to mock scoring.");
}

function normalizeAzurePronunciation(payload) {
  const best = payload.NBest?.[0] || {};
  if (payload.RecognitionStatus && payload.RecognitionStatus !== "Success") {
    throw new Error(`Azure recognition status: ${payload.RecognitionStatus}`);
  }
  if (!Object.keys(best).length) {
    throw new Error("Azure pronunciation returned no recognized speech");
  }

  const fullTextAssessment = best.PronunciationAssessment || best;
  const weakWords = (best.Words || [])
    .filter((word) => wordAccuracy(word) < 80 || wordErrorType(word) !== "None")
    .slice(0, 5)
    .map((word) => ({
      word: word.Word,
      score: round(wordAccuracy(word)),
      tipZh: tipForAzureWord(word),
      errorType: wordErrorType(word),
    }));

  return {
    source: "azure_pronunciation",
    pronunciation: round(fullTextAssessment.PronScore),
    accuracy: round(fullTextAssessment.AccuracyScore),
    fluency: round(fullTextAssessment.FluencyScore),
    completeness: round(fullTextAssessment.CompletenessScore),
    prosody: round(fullTextAssessment.ProsodyScore),
    weakWords,
    adviceZh: weakWords.length
      ? "重点练习低分单词的音节重音、元音长度和句子节奏。"
      : "整体发音清楚，继续保持句子重音和自然语调。",
    azureRecognitionStatus: payload.RecognitionStatus,
    transcript: best.Display || payload.DisplayText || "",
  };
}

function tipForAzureWord(word) {
  const errorType = wordErrorType(word);
  if (errorType === "Omission") return "这个词可能漏读了，跟读时放慢并读完整。";
  if (errorType === "Insertion") return "这里可能多读了词，注意和参考文本对齐。";
  if (errorType === "Mispronunciation") return "这个词发音不够准确，重点练习元音和重音。";
  if (errorType === "UnexpectedBreak") return "这里停顿有点突然，试着把短语连起来读。";
  if (errorType === "MissingBreak") return "这里应该有一个更自然的停顿。";
  if (errorType === "Monotone") return "语调变化偏少，可以强调关键词，让句子更自然。";
  return "这个词分数偏低，建议单独慢读再放回整句。";
}

function wordAccuracy(word) {
  return Number(word.PronunciationAssessment?.AccuracyScore ?? word.AccuracyScore ?? 0);
}

function wordErrorType(word) {
  return word.PronunciationAssessment?.ErrorType || word.ErrorType || "Unknown";
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function stripDataUrlPrefix(value) {
  return String(value).replace(/^data:[^;]+;base64,/, "");
}
