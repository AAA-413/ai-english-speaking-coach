# 路线 B 交接文档：稳定转写、纠错总结、发音跟读

整理日期：2026-06-05  
适用对象：负责路线 B 的开发者，以及辅助开发的 AI agent  
前置阅读：先读 [GStack dual-track phase plan](gstack-dual-track-phase-plan.md)，再读本文。

## 1. 你负责什么

路线 B 的目标是把“实时对话”变成“可解释的学习反馈”。

你负责：

- 稳定转写：把用户每轮发言变成 final transcript。
- 语法/表达纠错：引用用户原句，给出 corrected version 和中文解释。
- 课后总结：输出总分、分项分、目标完成度、复练任务。
- scripted 跟读发音评测：用户读固定句子，返回发音分和 weak words。
- mock fallback：任何外部 provider 失败时，仍能给前端返回可演示的数据。

你不负责：

- 实时 WebRTC 语音连接。
- OpenAI Realtime 的浏览器连接逻辑。
- 主练习页 UI。
- 实时 AI 语音回答。

## 2. 直接丢给 AI 的任务提示词

如果你用 AI 辅助开发，可以把下面这段直接发给它：

```text
你现在在开发一个英语口语练习工具，项目目标是三天完成赛题 Demo。

我负责路线 B：稳定转写、语法/表达纠错、课后总结、scripted 跟读发音评测。

请先阅读这些文档：
- docs/gstack-dual-track-phase-plan.md
- docs/team-alignment-voice-mvp.md
- docs/route-b-ai-handoff.md

请只实现路线 B，不要改 WebRTC 实时语音主链路。

实现目标：
1. 定义 Scenario、PracticeSession、Turn、Correction、SessionSummary、PronunciationAssessment 类型。
2. 实现 3 个场景配置：面试、点餐、会议。
3. 实现 summary API：输入 session turns，输出结构化 SessionSummary JSON。
4. 实现 correction 逻辑：每条纠错必须引用用户原句，给 corrected、中文解释和 betterExpression。
5. 实现 scripted pronunciation API：输入 referenceText 和用户录音，返回 pronunciation/accuracy/fluency/completeness/prosody/weakWords。
6. 外部 AI/STT/发音评测 provider 失败时，必须返回 mock fallback，保证演示不断。
7. 不要做登录、数据库、长期历史、企业后台、移动端。

优先级：
- P0：types、mock scenarios、summary mock、pronunciation mock、API contract。
- P1：接真实文本 LLM 做纠错总结。
- P2：接真实 STT 和 Azure/Speechace 发音评测。

验收：
- 前端结束练习后能调用 summary API 并渲染报告。
- 报告有总分和 pronunciation、fluency、grammar、vocabulary、interaction 五个分项分。
- 报告有 3 条以内高价值纠错。
- 跟读评测能返回分数和 weak words。
- 没有 API key 时仍然能跑完整 Demo。
```

## 3. 与路线 A 的边界

路线 A 会先提供：

- 场景选择结果。
- 练习 session id。
- 用户/AI 对话 turns。
- 结束练习触发点。
- 报告页和跟读页 UI 壳子。

路线 B 需要提供：

- summary 数据结构。
- pronunciation 数据结构。
- mock 和真实 provider 共用的 API 响应格式。

边界约定：

```text
路线 A 不关心你用哪个 STT、哪个 LLM、哪个发音评测 provider。
路线 B 不关心 WebRTC 怎么连、音频实时播放怎么做。
双方只通过 types 和 API contract 对接。
```

## 4. 最小接口契约

### 4.1 课后总结

```http
POST /api/sessions/:id/summary
```

请求体：

```json
{
  "scenarioId": "job_interview",
  "level": "B1",
  "turns": [
    {
      "id": "turn_1",
      "speaker": "assistant",
      "sequence": 1,
      "transcript": "Tell me about yourself."
    },
    {
      "id": "turn_2",
      "speaker": "user",
      "sequence": 2,
      "transcript": "I am work as product manager for three years."
    }
  ]
}
```

响应体：

```json
{
  "overallScore": 78,
  "scores": {
    "pronunciation": 72,
    "fluency": 76,
    "grammar": 80,
    "vocabulary": 74,
    "interaction": 82
  },
  "goalCompletion": [
    "Completed a short self-introduction",
    "Explained work experience",
    "Needs stronger examples for achievements"
  ],
  "corrections": [
    {
      "type": "grammar",
      "severity": "medium",
      "original": "I am work as product manager for three years.",
      "corrected": "I have worked as a product manager for three years.",
      "explanationZh": "表达持续到现在的经历，用现在完成时；product manager 前需要冠词 a。",
      "betterExpression": "I've spent the last three years working as a product manager."
    }
  ],
  "betterExpressions": [
    "I've spent the last three years working as a product manager.",
    "One project I'm proud of involved improving user retention."
  ],
  "pronunciationFocus": "Practice sentence stress in longer answers.",
  "practiceTasks": [
    "Repeat your self-introduction in 45 seconds.",
    "Prepare one STAR-format project story.",
    "Shadow the recommended sentence once."
  ]
}
```

### 4.2 稳定转写

```http
POST /api/sessions/:id/transcribe
```

三天内这个接口可以先不做真实音频处理。如果路线 A 暂时只能提供 transcript text，就先直接 passthrough。

推荐请求：

```json
{
  "turnId": "turn_2",
  "audioBase64": "optional",
  "roughTranscript": "I am work as product manager for three years."
}
```

推荐响应：

```json
{
  "turnId": "turn_2",
  "transcript": "I have worked as a product manager for three years.",
  "confidence": 0.86,
  "source": "mock"
}
```

`source` 可选值：

```text
mock
rough_transcript
openai_transcribe
mimo_asr
deepgram
```

### 4.3 跟读发音评测

```http
POST /api/pronunciation/scripted
```

请求体：

```json
{
  "scenarioId": "restaurant_ordering",
  "referenceText": "Could I get a medium latte with oat milk, please?",
  "audioBase64": "optional"
}
```

响应体：

```json
{
  "pronunciation": 78,
  "accuracy": 74,
  "fluency": 82,
  "completeness": 95,
  "prosody": 70,
  "weakWords": [
    {
      "word": "medium",
      "score": 68,
      "tipZh": "注意 medium 的第一音节重音。"
    },
    {
      "word": "oat",
      "score": 64,
      "tipZh": "注意 oat 的双元音，不要读得太短。"
    }
  ],
  "adviceZh": "整体表达清楚，下一步重点练习重音和句尾礼貌语气。",
  "source": "mock"
}
```

`source` 可选值：

```text
mock
azure_pronunciation
speechace
```

## 5. 共享类型建议

如果项目使用 TypeScript，优先把类型放在共享目录，例如：

```text
lib/types/practice.ts
```

建议类型：

```ts
export type ScenarioId = "job_interview" | "restaurant_ordering" | "business_meeting";
export type Level = "A2" | "B1" | "B2";

export type Scenario = {
  id: ScenarioId;
  title: string;
  description: string;
  aiRole: string;
  userRole: string;
  level: Level;
  goals: string[];
  keywords: string[];
  rubric: Record<string, number>;
  openingPrompt: string;
  followUpQuestions: string[];
  pronunciationSentences: string[];
};

export type Turn = {
  id: string;
  speaker: "user" | "assistant";
  sequence: number;
  transcript: string;
  startedAt?: string;
  endedAt?: string;
  confidence?: number;
};

export type Correction = {
  type: "grammar" | "vocabulary" | "expression" | "pragmatics";
  severity: "low" | "medium" | "high";
  original: string;
  corrected: string;
  explanationZh: string;
  betterExpression?: string;
};

export type SessionSummary = {
  overallScore: number;
  scores: {
    pronunciation: number;
    fluency: number;
    grammar: number;
    vocabulary: number;
    interaction: number;
  };
  goalCompletion: string[];
  corrections: Correction[];
  betterExpressions: string[];
  pronunciationFocus: string;
  practiceTasks: string[];
};

export type PronunciationAssessment = {
  pronunciation: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number;
  weakWords: Array<{
    word: string;
    score: number;
    tipZh: string;
  }>;
  adviceZh: string;
  source: "mock" | "azure_pronunciation" | "speechace";
};
```

## 6. 场景配置最小要求

至少三个场景：

- `job_interview`
- `restaurant_ordering`
- `business_meeting`

每个场景必须包含：

- AI role
- User role
- goals
- keywords
- opening prompt
- follow-up questions
- pronunciation sentences

跟读句子要贴合场景，不要用泛泛的英语句子。

示例：

```ts
{
  id: "restaurant_ordering",
  title: "点餐",
  aiRole: "barista",
  userRole: "customer",
  level: "B1",
  goals: [
    "Order one drink clearly",
    "Specify size and milk preference",
    "Confirm the final order"
  ],
  keywords: ["medium", "oat milk", "to go", "receipt"],
  pronunciationSentences: [
    "Could I get a medium latte with oat milk, please?",
    "Can I have that to go?"
  ]
}
```

## 7. Summary prompt 要点

不要让模型自由发挥成一篇作文。必须要求 JSON。

Prompt 约束：

```text
You are an English speaking coach.
Analyze the learner's spoken English transcript in the selected scenario.
Return valid JSON only.
Choose at most 3 high-value corrections.
Every correction must quote the learner's original sentence.
Prefer practical, encouraging feedback.
Do not claim an official CEFR score.
Scores should be 0-100 and consistent with the evidence.
Chinese explanations should be short and actionable.
```

注意：

- 不纠小错堆满屏幕。
- 不要把 AI assistant 的话当成用户错误。
- 只分析 `speaker === "user"` 的 turn。
- 低置信 transcript 不做强纠错，可改成建议。

## 8. 发音评测策略

三天内不要强行做自由对话音素级评分。

采用：

```text
自由对话：整体 pronunciation / fluency 趋势
scripted 跟读：具体 accuracy / fluency / completeness / prosody / weak words
```

实现顺序：

1. 先写 mock provider，保证 UI 和 API 契约稳定。
2. 如果时间够，再接 Azure Pronunciation Assessment 或 Speechace。
3. 真实 provider 和 mock provider 必须返回同一结构。

## 9. Mock fallback 规则

任何 provider 失败都不能让演示断掉。

必须有：

- `mockSummary`
- `mockPronunciationAssessment`
- `mockTranscription`

建议环境变量：

```bash
NEXT_PUBLIC_DEMO_MODE=false
USE_MOCK_AI=false
```

行为：

```text
如果没有 API key -> 自动 mock
如果 provider 超时 -> 自动 mock
如果 JSON parse 失败 -> repair 一次，仍失败则 mock
```

## 10. 验收清单

提交前自查：

- [ ] summary API 能在无 API key 情况下返回 mock report。
- [ ] pronunciation API 能在无 API key 情况下返回 mock score。
- [ ] summary 只分析用户 turn。
- [ ] corrections 每条都有 original、corrected、explanationZh。
- [ ] report 至少有 5 个分项分。
- [ ] pronunciation 至少有 2 个 weak words。
- [ ] 没有登录、数据库、历史趋势等超范围内容。
- [ ] 没有修改路线 A 的 WebRTC 主逻辑，除非双方已约定。

## 11. 推荐分支名

```bash
git checkout main
git pull
git checkout -b feat/analysis-summary-pronunciation
```

提交建议：

```bash
git add [changed files]
git commit -m "Add analysis summary and pronunciation contracts"
git push -u origin feat/analysis-summary-pronunciation
```

## 12. 最重要的判断

路线 B 的第一目标不是“接上最完美的外部服务”，而是保证产品闭环成立：

```text
结束练习后，用户一定能看到有证据、有分数、有建议的学习报告。
```

真实 provider 是增强项，mock fallback 是演示生命线。

## 13. 当前代码状态

截至 2026-06-05，`main` 已经包含基础的真实课后总结 provider：

- 有 `OPENAI_API_KEY` 且 `USE_MOCK_ANALYSIS` 不是 `true` 时，`POST /api/sessions/:id/summary` 会调用 OpenAI Responses API 生成结构化 JSON。
- 没有 key、开启 `DEMO_MODE`、开启 `USE_MOCK_ANALYSIS`，或 provider 失败时，会自动返回 mock summary。
- scripted pronunciation 和 stable transcription 仍然是 mock/passthrough，等路线 B 继续接 Azure/Speechace/STT。
