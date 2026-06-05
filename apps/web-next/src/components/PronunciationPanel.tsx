import type { PronunciationAssessment } from "@/shared/practice";

type PronunciationPanelProps = {
  pronunciationText: string;
  isRecording: boolean;
  result: PronunciationAssessment | null;
  onRecord: () => void;
  onScore: () => void;
};

export function PronunciationPanel({
  pronunciationText,
  isRecording,
  result,
  onRecord,
  onScore,
}: PronunciationPanelProps) {
  return (
    <section className="pronunciation-panel">
      <div>
        <p className="eyebrow">Scripted pronunciation</p>
        <h3>{pronunciationText || "Recommended sentence"}</h3>
      </div>
      <div className="pronunciation-actions">
        <button className="secondary-button" onClick={onRecord} type="button">
          {isRecording ? "Stop" : "Record"}
        </button>
        <button className="secondary-button" onClick={onScore} type="button">
          Score
        </button>
      </div>

      {result ? (
        <div className="pronunciation-result">
          <div className="score-grid">
            {(["pronunciation", "accuracy", "fluency", "completeness", "prosody"] as const).map((key) => (
              <div className="mini-score" key={key}>
                <span>{key}</span>
                <strong>{result[key]}</strong>
              </div>
            ))}
          </div>
          <p className="audio-note">
            Provider: {result.source}. {result.providerError ? `Fallback: ${result.providerError}` : result.audioReceived ? "Audio payload received." : "Mock score without audio."}
          </p>
          <div className="weak-word-list">
            {result.weakWords.map((word) => (
              <span key={`${word.word}-${word.score}`}>
                {word.word} · {word.score}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
