"use client";

import { useMemo, useState } from "react";
import type { PracticeTurn, Scenario, ScenarioId, ScoreBreakdown } from "@/shared/practice";

type PracticeShellProps = {
  appName: string;
  scenarios: Scenario[];
};

const scorePreview: ScoreBreakdown = {
  pronunciation: 78,
  fluency: 81,
  grammar: 76,
  vocabulary: 80,
  interaction: 84,
};

function createTurn(speaker: PracticeTurn["speaker"], sequence: number, transcript: string): PracticeTurn {
  return {
    id: `turn_${sequence}_${Date.now().toString(36)}`,
    speaker,
    sequence,
    transcript,
    source: "mock",
    startedAt: new Date().toISOString(),
  };
}

export function PracticeShell({ appName, scenarios }: PracticeShellProps) {
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>(scenarios[0]?.id ?? "job_interview");
  const [isActive, setIsActive] = useState(false);
  const [draftTurn, setDraftTurn] = useState("");
  const [turns, setTurns] = useState<PracticeTurn[]>([]);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0],
    [scenarios, selectedScenarioId],
  );

  const nextQuestion = selectedScenario.followUpQuestions[turns.filter((turn) => turn.speaker === "user").length % selectedScenario.followUpQuestions.length];

  function startPractice() {
    setIsActive(true);
    setTurns([createTurn("assistant", 1, selectedScenario.openingPrompt)]);
  }

  function endPractice() {
    setIsActive(false);
  }

  function addLearnerTurn() {
    const transcript = draftTurn.trim();
    if (!transcript) return;

    setTurns((currentTurns) => {
      const baseTurns = currentTurns.length
        ? currentTurns
        : [createTurn("assistant", 1, selectedScenario.openingPrompt)];
      const learnerTurn = createTurn("user", baseTurns.length + 1, transcript);
      const coachTurn = createTurn("assistant", baseTurns.length + 2, nextQuestion);
      return [...baseTurns, learnerTurn, coachTurn];
    });
    setDraftTurn("");
  }

  function selectScenario(id: ScenarioId) {
    setSelectedScenarioId(id);
    setIsActive(false);
    setTurns([]);
    setDraftTurn("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Parallel Next.js Shell</p>
          <h1>{appName}</h1>
        </div>
        <div className={isActive ? "status status-live" : "status"}>
          <span />
          {isActive ? "Session Active" : "Ready"}
        </div>
      </header>

      <section className="workspace" aria-label="Practice workspace">
        <aside className="scenario-rail" aria-label="Scenario selection">
          <div className="section-heading">
            <p>Scene</p>
            <strong>{scenarios.length}</strong>
          </div>
          <div className="scenario-list">
            {scenarios.map((scenario) => (
              <button
                className={scenario.id === selectedScenario.id ? "scenario-card selected" : "scenario-card"}
                key={scenario.id}
                onClick={() => selectScenario(scenario.id)}
                type="button"
              >
                <span>{scenario.label}</span>
                <strong>{scenario.title}</strong>
                <small>{scenario.level}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="practice-stage" aria-label="Practice room">
          <div className="stage-header">
            <div>
              <p>{selectedScenario.userRole} {"->"} {selectedScenario.aiRole}</p>
              <h2>{selectedScenario.title}</h2>
            </div>
            <div className="stage-actions">
              <button onClick={startPractice} type="button">
                Start
              </button>
              <button disabled={!turns.length} onClick={endPractice} type="button">
                End
              </button>
            </div>
          </div>

          <div className="objective-grid">
            {selectedScenario.goals.map((goal) => (
              <div className="objective" key={goal}>
                {goal}
              </div>
            ))}
          </div>

          <div className="transcript-panel" aria-live="polite">
            {(turns.length ? turns : [createTurn("assistant", 0, selectedScenario.openingPrompt)]).map((turn) => (
              <article className={`turn ${turn.speaker}`} key={turn.id}>
                <span>{turn.speaker === "user" ? "Learner" : "Coach"}</span>
                <p>{turn.transcript}</p>
              </article>
            ))}
          </div>

          <div className="turn-composer">
            <textarea
              aria-label="Learner turn"
              onChange={(event) => setDraftTurn(event.target.value)}
              placeholder="Type a learner turn for the migration smoke path"
              value={draftTurn}
            />
            <button disabled={!draftTurn.trim()} onClick={addLearnerTurn} type="button">
              Send
            </button>
          </div>
        </section>

        <aside className="feedback-rail" aria-label="Route B feedback">
          <div className="section-heading">
            <p>Route B</p>
            <strong>Typed</strong>
          </div>

          <div className="score-list">
            {Object.entries(scorePreview).map(([label, value]) => (
              <div className="score-row" key={label}>
                <span>{label}</span>
                <meter max="100" min="0" value={value} />
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="focus-block">
            <span>Pronunciation</span>
            <p>{selectedScenario.pronunciationSentences[0]}</p>
          </div>

          <div className="keyword-strip">
            {selectedScenario.keywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
