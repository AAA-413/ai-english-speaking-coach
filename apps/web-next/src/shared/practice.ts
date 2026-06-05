export type ScenarioId = "job_interview" | "restaurant_ordering" | "business_meeting";

export type EnglishLevel = "A2" | "B1" | "B2" | "C1";

export type CorrectionMode = "immersive" | "coach" | "post_session";

export type PracticeSpeaker = "assistant" | "user";

export type AnalysisSource =
  | "mock"
  | "rough_transcript"
  | "openai_transcribe"
  | "openai_summary"
  | "deepseek_v4"
  | "azure_pronunciation";

export type ScoreBreakdown = {
  pronunciation: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  interaction: number;
};

export type ScenarioRubric = {
  taskCompletion: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  interaction: number;
};

export type Scenario = {
  id: ScenarioId;
  title: string;
  label: string;
  description: string;
  aiRole: string;
  userRole: string;
  level: EnglishLevel;
  goals: string[];
  keywords: string[];
  rubric: ScenarioRubric;
  openingPrompt: string;
  followUpQuestions: string[];
  pronunciationSentences: string[];
};

export type PracticeTurn = {
  id: string;
  speaker: PracticeSpeaker;
  sequence: number;
  transcript: string;
  stableTranscript?: string;
  startedAt?: string;
  endedAt?: string;
  confidence?: number;
  source?: AnalysisSource;
};

export type Correction = {
  type: "grammar" | "vocabulary" | "expression" | "pronunciation" | "interaction";
  severity: "low" | "medium" | "high";
  original: string;
  corrected: string;
  explanationZh: string;
  betterExpression: string;
};

export type SessionSummary = {
  sessionId: string;
  scenarioId: ScenarioId;
  overallScore: number;
  scores: ScoreBreakdown;
  goalCompletion: string[];
  corrections: Correction[];
  betterExpressions: string[];
  pronunciationFocus: string;
  practiceTasks: string[];
  source: AnalysisSource;
  providerError?: string;
  generatedAt: string;
};

export type TranscriptionResult = {
  sessionId: string;
  turnId: string;
  transcript: string;
  confidence: number;
  source: AnalysisSource;
  providerError?: string;
};

export type PronunciationAssessment = {
  scenarioId: ScenarioId;
  referenceText: string;
  pronunciation: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number;
  weakWords: string[];
  source: AnalysisSource;
  providerError?: string;
};
