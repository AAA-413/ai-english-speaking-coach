export type ScenarioId = "job_interview" | "restaurant_ordering" | "business_meeting";

export type EnglishLevel = "A2" | "B1" | "B2" | "C1";

export type CorrectionMode = "immersive" | "coach" | "post_session";

export type PracticeSpeaker = "assistant" | "user";

export type RealtimeProvider = "openai" | "volc_doubao" | "mock";

export type PracticeStatus =
  | "idle"
  | "starting"
  | "connected"
  | "mock"
  | "user_speaking"
  | "ai_speaking"
  | "ending"
  | "ended"
  | "report_ready";

export type AnalysisSource =
  | "mock"
  | "rough_transcript"
  | "openai_transcribe"
  | "openai_responses"
  | "deepseek_v4"
  | "azure_pronunciation"
  | "volc_doubao";

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
  type: "grammar" | "vocabulary" | "expression" | "pronunciation" | "interaction" | "pragmatics";
  severity: "low" | "medium" | "high";
  original: string;
  corrected: string;
  explanationZh: string;
  betterExpression: string;
};

export type SessionSummary = {
  sessionId: string;
  scenarioId?: ScenarioId;
  overallScore: number;
  scores: ScoreBreakdown;
  goalCompletion: string[];
  corrections: Correction[];
  betterExpressions: string[];
  pronunciationFocus: string;
  practiceTasks: string[];
  recommendedPronunciationText: string;
  source: AnalysisSource;
  model?: string;
  providerError?: string;
  generatedAt?: string;
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
  audioReceived?: boolean;
  mimeType?: string | null;
  durationMs?: number | null;
  pronunciation: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number;
  weakWords: PronunciationWeakWord[];
  adviceZh?: string;
  transcript?: string;
  source: AnalysisSource;
  providerError?: string;
};

export type PronunciationWeakWord = {
  word: string;
  score: number;
  tipZh: string;
  errorType?: string;
};

export type HealthResponse = {
  ok: boolean;
  demoMode: boolean;
  hasOpenAIKey: boolean;
  hasDeepSeekKey: boolean;
  hasAzureSpeech: boolean;
  useMockAnalysis: boolean;
  realtimeProvider: RealtimeProvider;
  realtimeModel: string;
  transcribeModel: string;
  textModel: string;
  deepSeekTextModel: string;
  realtimeVoice: string;
  volcDoubao: VolcDoubaoHealth;
};

export type VolcDoubaoHealth = {
  provider: "volc_doubao";
  model: string;
  hasRtcAppId: boolean;
  hasRtcClientToken: boolean;
  hasRtcWebSdkUrl: boolean;
  hasS2sAppId: boolean;
  hasS2sToken: boolean;
  ready: boolean;
  clientReady: boolean;
  missing: string[];
  clientMissing: string[];
};

export type RealtimeSessionResponse = {
  mode: "mock" | "realtime" | "volc_doubao_setup";
  provider: RealtimeProvider;
  sessionId: string;
  reason?: string;
  scenario: Scenario;
  model?: string;
  clientSecret?: string;
  expiresAt?: string | number | null;
  rtcAppId?: string;
  clientToken?: string;
  sdkUrl?: string;
  roomId?: string;
  userId?: string;
  agentUserId?: string;
  serverStartRequired?: boolean;
  clientJoinReady?: boolean;
  s2sConfigPreview?: unknown;
};

export type EventLogEntry = {
  id: string;
  at: string;
  type: string;
  detail: string;
};

export type PronunciationAudio = {
  base64: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  recordedAt: string;
};

export type PracticeSessionSnapshot = {
  exportedAt: string;
  scenario: Scenario;
  session: {
    id: string | null;
    status: PracticeStatus;
    startedAt: string | null;
    endedAt: string | null;
    realtimeProvider: RealtimeProvider;
    level: EnglishLevel;
    correctionMode: CorrectionMode;
    voice: string;
  };
  turns: PracticeTurn[];
  eventLog: EventLogEntry[];
  summary: SessionSummary | null;
  pronunciationText: string;
  pronunciationAudio: Omit<PronunciationAudio, "base64"> | null;
  pronunciationResult: PronunciationAssessment | null;
};
