"use client";

import { useState } from "react";
import type {
  EventLogEntry,
  PracticeStatus,
  PracticeTurn,
  Scenario,
  SessionSummary,
} from "@/shared/practice";
import { EventLog } from "./EventLog";
import { SessionReport } from "./SessionReport";
import type { PronunciationAssessment } from "@/shared/practice";

type PracticeRoomProps = {
  scenario: Scenario;
  status: PracticeStatus;
  sessionId: string | null;
  realtimeLabel: string;
  turns: PracticeTurn[];
  eventLog: EventLogEntry[];
  summary: SessionSummary | null;
  pronunciationText: string;
  isRecordingPronunciation: boolean;
  pronunciationResult: PronunciationAssessment | null;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  onSendTurn: (value: string) => void;
  onEnd: () => void;
  onExport: () => void;
  onRecordPronunciation: () => void;
  onScorePronunciation: () => void;
};

export function PracticeRoom({
  scenario,
  status,
  sessionId,
  realtimeLabel,
  turns,
  eventLog,
  summary,
  pronunciationText,
  isRecordingPronunciation,
  pronunciationResult,
  remoteAudioRef,
  onSendTurn,
  onEnd,
  onExport,
  onRecordPronunciation,
  onScorePronunciation,
}: PracticeRoomProps) {
  const [draftTurn, setDraftTurn] = useState("");

  function submitTurn() {
    const value = draftTurn.trim();
    if (!value) return;
    onSendTurn(value);
    setDraftTurn("");
  }

  return (
    <section className="practice-panel">
      <header className="practice-header">
        <div>
          <p className="eyebrow">{scenario.userRole} -&gt; {scenario.aiRole}</p>
          <h2>{scenario.title}</h2>
        </div>
        <div className="status-pill">{status.replaceAll("_", " ")}</div>
      </header>

      <div className="diagnostic-bar">
        <div>
          <span>Mode</span>
          <strong>{realtimeLabel}</strong>
        </div>
        <div>
          <span>Session</span>
          <strong>{sessionId || "none"}</strong>
        </div>
        <div>
          <span>Turns</span>
          <strong>{turns.filter((turn) => turn.speaker === "user").length}</strong>
        </div>
        <button className="secondary-button" disabled={!sessionId && !turns.length} onClick={onExport} type="button">
          Export JSON
        </button>
      </div>

      <div className="goals-band">
        <div>
          <h3>Goals</h3>
          <ul>{scenario.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
        </div>
        <div>
          <h3>Keywords</h3>
          <div className="keyword-list">{scenario.keywords.map((keyword) => <span className="keyword" key={keyword}>{keyword}</span>)}</div>
        </div>
      </div>

      <div className="conversation-surface">
        <div className={`audio-strip ${["connected", "user_speaking", "ai_speaking", "mock"].includes(status) ? "live" : ""}`} aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
        <div className="transcript-list">
          {(turns.length ? turns : [{
            id: "opening",
            speaker: "assistant" as const,
            sequence: 0,
            transcript: scenario.openingPrompt,
          }]).map((turn) => (
            <article className={`turn ${turn.speaker}`} key={turn.id}>
              <div className="turn-label">{turn.speaker === "user" ? "Learner" : "Coach"}</div>
              <div>{turn.transcript}</div>
            </article>
          ))}
        </div>
      </div>

      <div className="composer-row">
        <input
          onChange={(event) => setDraftTurn(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitTurn();
          }}
          placeholder="Type a learner turn while Realtime is not connected"
          value={draftTurn}
        />
        <button className="secondary-button" onClick={submitTurn} type="button">Send Turn</button>
        <button className="danger-button" disabled={!turns.length} onClick={onEnd} type="button">End</button>
      </div>

      <EventLog events={eventLog} />

      <SessionReport
        isRecording={isRecordingPronunciation}
        onRecordPronunciation={onRecordPronunciation}
        onScorePronunciation={onScorePronunciation}
        pronunciationResult={pronunciationResult}
        pronunciationText={pronunciationText}
        summary={summary}
      />

      <audio ref={remoteAudioRef} autoPlay />
    </section>
  );
}
