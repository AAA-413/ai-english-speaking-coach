export function assessScriptedPronunciation({
  referenceText,
  recognizedTranscript,
  durationMs,
  audioReceived = false,
  providerError = "",
}) {
  const reference = normalizeWords(referenceText);
  const spoken = normalizeWords(recognizedTranscript);

  if (!audioReceived && !spoken.length) {
    return {
      source: "needs_recording",
      pronunciation: 0,
      accuracy: 0,
      fluency: 0,
      completeness: 0,
      prosody: 0,
      weakWords: [],
      adviceZh: "请先点击“录音”，读出推荐句子后再评分。",
      transcript: "",
    };
  }

  if (!spoken.length) {
    return {
      source: "audio_no_recognition",
      pronunciation: 45,
      accuracy: 35,
      fluency: durationFluencyScore({ durationMs, referenceWordCount: reference.length }),
      completeness: 25,
      prosody: 50,
      weakWords: reference.slice(0, 5).map((word) => ({
        word,
        score: 35,
        tipZh: "浏览器没有稳定识别到这个词，请靠近麦克风并放慢语速再试一次。",
      })),
      adviceZh: "已收到录音，但浏览器没有识别出清晰英文。请确认麦克风权限、环境噪声和发音音量。",
      transcript: "",
      providerError,
    };
  }

  const alignment = alignWords(reference, spoken);
  const completeness = Math.round((alignment.matchedReference / Math.max(1, reference.length)) * 100);
  const precision = Math.round((alignment.matchedSpoken / Math.max(1, spoken.length)) * 100);
  const accuracy = Math.round((completeness * 0.7) + (precision * 0.3));
  const fluency = durationFluencyScore({ durationMs, referenceWordCount: reference.length });
  const prosody = Math.round(Math.max(45, Math.min(94, (fluency * 0.65) + (accuracy * 0.35))));
  const pronunciation = Math.round((accuracy * 0.55) + (fluency * 0.2) + (completeness * 0.15) + (prosody * 0.1));

  return {
    source: "browser_speech_recognition",
    pronunciation: clamp(pronunciation),
    accuracy: clamp(accuracy),
    fluency: clamp(fluency),
    completeness: clamp(completeness),
    prosody: clamp(prosody),
    weakWords: weakWordsFromAlignment(reference, alignment.matchedIndices),
    adviceZh: buildAdvice({ pronunciation, completeness, fluency }),
    transcript: recognizedTranscript.trim(),
    providerError,
  };
}

function normalizeWords(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter(Boolean);
}

function alignWords(reference, spoken) {
  const matchedIndices = new Set();
  let matchedReference = 0;
  let matchedSpoken = 0;
  let cursor = 0;

  for (const spokenWord of spoken) {
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = cursor; index < reference.length; index += 1) {
      const score = wordSimilarity(reference[index], spokenWord);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
      if (score >= 0.96) break;
    }
    if (bestIndex !== -1 && bestScore >= 0.72) {
      matchedIndices.add(bestIndex);
      matchedReference += 1;
      matchedSpoken += 1;
      cursor = Math.min(bestIndex + 1, reference.length);
    }
  }

  return { matchedReference, matchedSpoken, matchedIndices };
}

function weakWordsFromAlignment(reference, matchedIndices) {
  return reference
    .map((word, index) => ({ word, index }))
    .filter((item) => !matchedIndices.has(item.index))
    .slice(0, 5)
    .map((item) => ({
      word: item.word,
      score: 45,
      tipZh: "识别结果中没有稳定匹配到这个词，建议单独慢读后再放回整句。",
    }));
}

function wordSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length <= 2 || b.length <= 2) return a[0] === b[0] ? 0.74 : 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let index = 1; index <= b.length; index += 1) rows[0][index] = index;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length][b.length];
}

function durationFluencyScore({ durationMs, referenceWordCount }) {
  if (!durationMs || durationMs <= 0) return 70;
  const minutes = durationMs / 60000;
  const wordsPerMinute = referenceWordCount / Math.max(minutes, 0.01);
  if (wordsPerMinute < 55) return 58;
  if (wordsPerMinute < 80) return 72;
  if (wordsPerMinute <= 150) return 88;
  if (wordsPerMinute <= 185) return 76;
  return 62;
}

function buildAdvice({ pronunciation, completeness, fluency }) {
  if (pronunciation >= 88) return "跟读内容和参考句高度匹配，继续保持清晰发音和自然节奏。";
  if (completeness < 70) return "有部分关键词没有稳定识别到，建议放慢速度，先读完整再追求流利。";
  if (fluency < 70) return "语速或停顿不够自然，建议按短语分组练习，再连成完整句子。";
  return "整体可理解，下一步重点练习低匹配词的重音、元音长度和连读。";
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
