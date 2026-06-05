"use client";

import { useEffect } from "react";
import { PracticeRoom } from "@/components/PracticeRoom";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { usePracticeSession } from "@/hooks/usePracticeSession";

export default function Home() {
  const practice = usePracticeSession();

  useEffect(() => {
    practice.refreshHealth().catch(() => {
      // Health is diagnostic-only; the mock path remains usable when it fails.
    });
  }, []);

  const realtimeLabel = [
    practice.realtimeProvider,
    practice.health?.demoMode ? "demo" : "",
    practice.realtimeProvider === "openai" && !practice.health?.hasOpenAIKey ? "no-key" : "",
    practice.realtimeProvider === "volc_doubao" && !practice.health?.volcDoubao.ready ? "doubao-missing-config" : "",
    practice.health?.hasDeepSeekKey ? "deepseek" : "",
    practice.health?.hasAzureSpeech ? "azure-speech" : "",
  ].filter(Boolean).join(" / ");

  return (
    <main className="app-shell">
      <ScenarioPicker
        correctionMode={practice.correctionMode}
        health={practice.health}
        level={practice.level}
        onCorrectionModeChange={practice.setCorrectionMode}
        onLevelChange={practice.setLevel}
        onRealtimeProviderChange={practice.setRealtimeProvider}
        onScenarioChange={practice.selectScenario}
        onStart={practice.startPractice}
        onVoiceChange={practice.setVoice}
        realtimeProvider={practice.realtimeProvider}
        scenarios={practice.scenarios}
        selectedScenarioId={practice.selectedScenarioId}
        statusText={realtimeLabel || practice.status}
        voice={practice.voice}
      />

      <PracticeRoom
        eventLog={practice.eventLog}
        isRecordingPronunciation={practice.isRecordingPronunciation}
        onEnd={practice.endPractice}
        onExport={practice.exportSessionJson}
        onRecordPronunciation={practice.togglePronunciationRecording}
        onScorePronunciation={practice.scoreCurrentPronunciation}
        onSendTurn={practice.sendTypedTurn}
        pronunciationResult={practice.pronunciationResult}
        pronunciationText={practice.pronunciationText || practice.selectedScenario.pronunciationSentences[0]}
        realtimeLabel={realtimeLabel || practice.status}
        remoteAudioRef={practice.remoteAudioRef}
        scenario={practice.selectedScenario}
        sessionId={practice.sessionId}
        status={practice.status}
        summary={practice.summary}
        turns={practice.turns}
      />
    </main>
  );
}
