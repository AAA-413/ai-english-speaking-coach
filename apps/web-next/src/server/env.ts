import type { RealtimeProvider } from "@/shared/practice";

export function loadRealtimeProvider(value = process.env.REALTIME_PROVIDER): RealtimeProvider {
  if (value === "volc_doubao" || value === "mock") return value;
  return "openai";
}

export function shouldUseMockAnalysis() {
  return process.env.DEMO_MODE === "true"
    || process.env.USE_MOCK_ANALYSIS === "true"
    || !(process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY);
}

export function shouldUseMockPronunciation() {
  return process.env.DEMO_MODE === "true"
    || process.env.USE_MOCK_PRONUNCIATION === "true"
    || !process.env.AZURE_SPEECH_KEY
    || !(process.env.AZURE_SPEECH_ENDPOINT || process.env.AZURE_SPEECH_REGION);
}
