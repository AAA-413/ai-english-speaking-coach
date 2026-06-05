import type { SessionSummary } from "@/shared/practice";
import { PronunciationPanel } from "./PronunciationPanel";

type SessionReportProps = {
  summary: SessionSummary | null;
  pronunciationText: string;
  isRecording: boolean;
  pronunciationResult: Parameters<typeof PronunciationPanel>[0]["result"];
  onRecordPronunciation: () => void;
  onScorePronunciation: () => void;
};

export function SessionReport({
  summary,
  pronunciationText,
  isRecording,
  pronunciationResult,
  onRecordPronunciation,
  onScorePronunciation,
}: SessionReportProps) {
  if (!summary) return null;

  return (
    <section className="report-panel">
      <div className="report-header">
        <div>
          <p className="eyebrow">Post-session report</p>
          <h2>Practice summary</h2>
        </div>
        <div
          className="score-dial"
          style={{ background: `conic-gradient(var(--teal) ${summary.overallScore}%, #edf1ed 0)` }}
        >
          {summary.overallScore}
        </div>
      </div>

      <div className="score-grid">
        {Object.entries(summary.scores).map(([label, value]) => (
          <div className="score-item" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="report-grid">
        <section>
          <h3>Corrections</h3>
          <div>
            {summary.corrections.map((item) => (
              <article className="correction-card" key={`${item.original}-${item.corrected}`}>
                <span>{item.type} · {item.severity}</span>
                <p><strong>Original:</strong> {item.original}</p>
                <p><strong>Corrected:</strong> {item.corrected}</p>
                <p>{item.explanationZh}</p>
                <em>{item.betterExpression}</em>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h3>Next Practice</h3>
          <ul>
            {summary.practiceTasks.map((task) => <li key={task}>{task}</li>)}
          </ul>
        </section>
      </div>

      <PronunciationPanel
        isRecording={isRecording}
        onRecord={onRecordPronunciation}
        onScore={onScorePronunciation}
        pronunciationText={pronunciationText}
        result={pronunciationResult}
      />
    </section>
  );
}
