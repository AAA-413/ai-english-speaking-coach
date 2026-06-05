import type {
  CorrectionMode,
  EnglishLevel,
  EventLogEntry,
  PracticeSessionSnapshot,
  PracticeStatus,
  PracticeTurn,
  PronunciationAssessment,
  PronunciationAudio,
  RealtimeProvider,
  Scenario,
  SessionSummary,
} from "@/shared/practice";

export function buildSessionSnapshot({
  scenario,
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
  pronunciationAudio,
  pronunciationResult,
}: {
  scenario: Scenario;
  sessionId: string | null;
  status: PracticeStatus;
  startedAt: string | null;
  endedAt: string | null;
  realtimeProvider: RealtimeProvider;
  level: EnglishLevel;
  correctionMode: CorrectionMode;
  voice: string;
  turns: PracticeTurn[];
  eventLog: EventLogEntry[];
  summary: SessionSummary | null;
  pronunciationText: string;
  pronunciationAudio: PronunciationAudio | null;
  pronunciationResult: PronunciationAssessment | null;
}): PracticeSessionSnapshot {
  return {
    exportedAt: new Date().toISOString(),
    scenario,
    session: {
      id: sessionId,
      status,
      startedAt,
      endedAt,
      realtimeProvider,
      level,
      correctionMode,
      voice,
    },
    turns,
    eventLog,
    summary,
    pronunciationText,
    pronunciationAudio: pronunciationAudio
      ? {
          mimeType: pronunciationAudio.mimeType,
          sizeBytes: pronunciationAudio.sizeBytes,
          durationMs: pronunciationAudio.durationMs,
          recordedAt: pronunciationAudio.recordedAt,
        }
      : null,
    pronunciationResult,
  };
}

export function downloadSessionSnapshot(snapshot: PracticeSessionSnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `english-coach-${snapshot.session.id || "session"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
