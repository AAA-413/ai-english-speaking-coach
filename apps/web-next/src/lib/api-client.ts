import type {
  CorrectionMode,
  EnglishLevel,
  HealthResponse,
  PracticeTurn,
  PronunciationAssessment,
  RealtimeProvider,
  RealtimeSessionResponse,
  ScenarioId,
  SessionSummary,
  TranscriptionResult,
} from "@/shared/practice";

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function getHealth() {
  return apiJson<HealthResponse>("/api/health");
}

export function createRealtimeSession(input: {
  scenarioId: ScenarioId;
  level: EnglishLevel;
  correctionMode: CorrectionMode;
  voice: string;
  provider: RealtimeProvider;
}) {
  return apiJson<RealtimeSessionResponse>("/api/realtime/session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createSessionSummary(input: {
  sessionId: string;
  scenarioId: ScenarioId;
  level: EnglishLevel;
  turns: PracticeTurn[];
}) {
  return apiJson<SessionSummary>(`/api/sessions/${input.sessionId}/summary`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function transcribeTurn(input: {
  sessionId: string;
  turnId: string;
  audioBase64?: string;
  roughTranscript?: string;
  referenceText?: string;
  mimeType?: string;
  fileName?: string;
}) {
  return apiJson<TranscriptionResult>(`/api/sessions/${input.sessionId}/transcribe`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function scorePronunciation(input: {
  scenarioId: ScenarioId;
  referenceText: string;
  audioBase64?: string;
  mimeType?: string;
  durationMs?: number;
}) {
  return apiJson<PronunciationAssessment>("/api/pronunciation/scripted", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
