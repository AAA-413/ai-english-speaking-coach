import type {
  CorrectionMode,
  EnglishLevel,
  HealthResponse,
  RealtimeProvider,
  Scenario,
  ScenarioId,
} from "@/shared/practice";

type ScenarioPickerProps = {
  scenarios: Scenario[];
  selectedScenarioId: ScenarioId;
  level: EnglishLevel;
  correctionMode: CorrectionMode;
  realtimeProvider: RealtimeProvider;
  voice: string;
  statusText: string;
  health: HealthResponse | null;
  onScenarioChange: (id: ScenarioId) => void;
  onLevelChange: (level: EnglishLevel) => void;
  onCorrectionModeChange: (mode: CorrectionMode) => void;
  onRealtimeProviderChange: (provider: RealtimeProvider) => void;
  onVoiceChange: (voice: string) => void;
  onStart: () => void;
};

export function ScenarioPicker({
  scenarios,
  selectedScenarioId,
  level,
  correctionMode,
  realtimeProvider,
  voice,
  statusText,
  health,
  onScenarioChange,
  onLevelChange,
  onCorrectionModeChange,
  onRealtimeProviderChange,
  onVoiceChange,
  onStart,
}: ScenarioPickerProps) {
  return (
    <aside className="setup-panel" aria-label="Practice setup">
      <div className="brand-row">
        <div className="brand-mark">AI</div>
        <div>
          <h1>English Speaking Coach</h1>
          <p>Next.js TypeScript</p>
        </div>
      </div>

      <section className="control-group">
        <h2>Scenario</h2>
        <div className="scenario-list">
          {scenarios.map((scenario) => (
            <button
              className={`scenario-button ${scenario.id === selectedScenarioId ? "active" : ""}`}
              key={scenario.id}
              onClick={() => onScenarioChange(scenario.id)}
              type="button"
            >
              <strong>{scenario.label}</strong>
              <span>{scenario.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="control-group">
        <h2>Level</h2>
        <div className="segmented" role="group" aria-label="Level">
          {(["A2", "B1", "B2"] as EnglishLevel[]).map((item) => (
            <button
              className={`segment ${item === level ? "active" : ""}`}
              key={item}
              onClick={() => onLevelChange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="control-group">
        <h2>Correction</h2>
        <select value={correctionMode} onChange={(event) => onCorrectionModeChange(event.target.value as CorrectionMode)}>
          <option value="post_session">Post-session</option>
          <option value="coach">Coach</option>
          <option value="immersive">Immersive</option>
        </select>
      </section>

      <section className="control-group">
        <h2>Realtime</h2>
        <select value={realtimeProvider} onChange={(event) => onRealtimeProviderChange(event.target.value as RealtimeProvider)}>
          <option value="openai">OpenAI Realtime</option>
          <option value="volc_doubao">Doubao O2.0</option>
          <option value="mock">Mock</option>
        </select>
        <p className="control-note">
          {realtimeProvider === "volc_doubao"
            ? health?.volcDoubao.ready ? "Doubao config ready" : "Doubao config incomplete"
            : realtimeProvider === "openai"
              ? health?.hasOpenAIKey ? "OpenAI key ready" : "OpenAI key missing, mock fallback"
              : "Forced mock mode"}
        </p>
      </section>

      <section className="control-group">
        <h2>Voice</h2>
        <select value={voice} onChange={(event) => onVoiceChange(event.target.value)}>
          <option value="marin">Marin</option>
          <option value="alloy">Alloy</option>
          <option value="verse">Verse</option>
        </select>
      </section>

      <button className="primary-button" onClick={onStart} type="button">
        Start Practice
      </button>
      <p className="control-note">Status: {statusText}</p>
    </aside>
  );
}
