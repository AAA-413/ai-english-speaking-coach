# GStack 双链路阶段计划：英语口语练习工具

整理日期：2026-06-05  
项目周期：3 天  
协作目标：把“实时语音对话”和“稳定转写/纠错/总结/跟读评测”拆成两条可并行开发路线，降低集成风险。

## 1. 一句话目标

三天内交付一个可演示的英语口语练习工具：

```text
场景选择 -> 实时语音对话 -> 稳定转写 -> 纠错总结 -> 跟读发音评测 -> 课后报告
```

核心产品判断：

- 不是普通聊天工具，而是场景化口语训练工具。
- 实时链路负责自然、低延迟、可打断。
- 分析链路负责准确、可解释、可量化。
- 演示时必须有 mock fallback，不能把最终展示完全压在外部 API 稳定性上。

## 2. 当前输入

已有文档：

- [Design draft](ai-english-speaking-coach-design.md)
- [Team alignment voice MVP](team-alignment-voice-mvp.md)

当前仓库状态：

- 仓库：`AAA-413/ai-english-speaking-coach`
- 协作者：`bei-shan`，权限 `write`
- 分支保护：个人私有仓库免费版显示 `Not enforced`
- 团队约定：功能开发走 feature branch + pull request

## 3. 整体架构框架

推荐先用一个 Web app 承载前后端，减少三天内的部署和集成成本。

```text
Browser Client
  - Scenario picker
  - Practice room
  - WebRTC realtime connection
  - Transcript panel
  - Session report
  - Scripted pronunciation practice

App API
  - Realtime session token
  - Session lifecycle
  - Turn/audio upload
  - Stable transcription
  - Correction and summary
  - Scripted pronunciation assessment

AI Providers
  - OpenAI Realtime WebRTC
  - OpenAI Transcribe / MiMo ASR / Deepgram
  - Text LLM for correction and summary
  - Azure Pronunciation Assessment / Speechace / mock
```

建议代码结构：

```text
.
├── apps/
│   └── web/
│       ├── app/ or src/
│       ├── components/
│       ├── lib/
│       │   ├── realtime/
│       │   ├── assessment/
│       │   ├── scenarios/
│       │   └── mock/
│       └── api/
├── packages/
│   └── shared/
│       ├── types/
│       ├── schemas/
│       └── prompts/
└── docs/
```

如果为了更快，也可以先不建 monorepo，只做一个 Next.js 项目：

```text
.
├── app/
├── components/
├── lib/
│   ├── realtime/
│   ├── assessment/
│   ├── scenarios/
│   └── mock/
├── app/api/
└── docs/
```

三天内优先选第二种，除非你们已经有固定 monorepo 模板。

## 4. 双链路设计

### 路线 A：实时对话链路

目标：用户能在浏览器里开麦，与 AI 进行低延迟语音对话。

链路：

```text
Browser microphone
  -> WebRTC peer connection
  -> OpenAI Realtime
  -> AI audio response
  -> Browser speaker
```

职责：

- 麦克风授权和设备状态
- WebRTC 连接和断开
- Realtime session 创建
- 场景 prompt 注入
- AI 语音回复
- 打断和连接状态展示
- 实时字幕或对话事件展示

不负责：

- 严肃语法纠错
- 细粒度发音评分
- 最终课后总结

关键 API：

```http
POST /api/realtime/session
```

入参：

```json
{
  "scenarioId": "job_interview",
  "level": "B1",
  "correctionMode": "post_session",
  "voice": "alloy"
}
```

返回：

```json
{
  "sessionId": "sess_123",
  "clientSecret": "ephemeral_token",
  "model": "gpt-realtime-2",
  "expiresAt": "2026-06-05T12:00:00Z"
}
```

前端状态机：

```text
idle
  -> requesting_microphone
  -> creating_realtime_session
  -> connecting
  -> connected
  -> user_speaking
  -> ai_speaking
  -> ending
  -> ended
  -> report_generating
  -> report_ready
```

验收标准：

- 用户能点击开始练习并授权麦克风。
- 连接成功后，用户说话，AI 能语音回答。
- AI 回复与场景角色一致，例如面试官、服务员、会议同事。
- AI 单轮回复控制在 2-3 句内。
- 用户可以点击结束练习。
- 失败时有明确 UI 状态，不出现空白页面。

### 路线 B：稳定转写、纠错、总结、跟读评测链路

目标：把对话变成可解释的学习反馈。

链路：

```text
User turn audio / transcript
  -> stable transcription
  -> correction and expression analysis
  -> session summary
  -> scripted pronunciation practice
  -> final report
```

职责：

- 收集每轮用户发言
- 生成 final transcript
- 输出结构化纠错
- 输出课后总结
- 输出分项评分
- 生成跟读句子
- 对跟读录音做发音评测
- API 失败时返回 mock report

不负责：

- 实时 AI 语音回答
- WebRTC 连接细节
- 实时打断体验

关键 API：

```http
POST /api/sessions
POST /api/sessions/:id/turns
POST /api/sessions/:id/transcribe
POST /api/sessions/:id/summary
POST /api/pronunciation/scripted
```

最小数据模型：

```ts
type Scenario = {
  id: string;
  title: string;
  role: string;
  level: "A2" | "B1" | "B2";
  goals: string[];
  keywords: string[];
  rubric: Record<string, number>;
  followUpQuestions: string[];
  pronunciationSentences: string[];
};

type PracticeSession = {
  id: string;
  scenarioId: string;
  level: string;
  correctionMode: "immersive" | "coach" | "post_session";
  startedAt: string;
  endedAt?: string;
  turns: Turn[];
};

type Turn = {
  id: string;
  speaker: "user" | "assistant";
  sequence: number;
  transcript?: string;
  startedAt?: string;
  endedAt?: string;
  audioUrl?: string;
};

type Correction = {
  type: "grammar" | "vocabulary" | "expression" | "pragmatics";
  severity: "low" | "medium" | "high";
  original: string;
  corrected: string;
  explanationZh: string;
  betterExpression?: string;
};

type SessionSummary = {
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
```

验收标准：

- 结束练习后能生成一份完整报告。
- 报告引用用户原句，不只给泛泛建议。
- 至少给 3 条纠错或表达优化。
- 至少给 5 个分项分数。
- 至少生成 1 条跟读句子。
- 发音评测服务不可用时，使用 mock 结果继续演示。

## 5. 两条链路的集成点

两条链路的边界必须清楚，否则容易互相卡住。

| 集成点 | 路线 A 输出 | 路线 B 输入 | 最小可用做法 |
|---|---|---|---|
| Session | `sessionId`, `scenarioId`, `level` | 创建分析上下文 | 前端生成 sessionId 也可以 |
| Transcript | realtime transcript events | final transcript 候选 | 先存文本，不强依赖音频切片 |
| User turns | 用户发言轮次 | 纠错和总结材料 | 先按 UI 中的用户消息切 turn |
| End session | 用户点击结束 | 触发 summary | 同步请求即可，不必上队列 |
| Pronunciation sentence | 场景/总结生成 | 跟读评测 reference text | 场景内置 1-2 句兜底 |

三天内允许的简化：

- 不做数据库，先用浏览器 state + local storage + mock persistence。
- 不做后台队列，结束练习时同步生成 summary。
- 不强求音频每轮完美切片，先保证 transcript 和 report。
- 发音评测先接 mock，再替换成 Azure/Speechace。

## 6. 阶段计划

### Phase 0：项目框架和契约，0.5 天

目标：让两个人可以并行开工，不互相等。

任务：

- 选定技术栈：Next.js 或 React + Vite + API server。
- 建页面骨架：场景选择、练习房间、课后报告、跟读练习。
- 建共享类型：Scenario、Session、Turn、Summary、Correction。
- 建 mock 数据：3 个场景、1 份 mock transcript、1 份 mock report。
- 建 API contract 文档或类型文件。

负责人建议：

- A：页面骨架和 mock UI
- B：API contract、provider wrapper、环境变量

验收：

- 本地应用能启动。
- 不接任何 AI API，也能走完整 UI 流程。
- 两个人基于同一套 types 开发。

### Phase 1：实时对话链路，Day 1

目标：跑通 OpenAI Realtime WebRTC。

任务：

- 后端实现 `POST /api/realtime/session`。
- 前端实现 WebRTC connection helper。
- 前端练习页接入麦克风权限。
- 注入场景 prompt。
- 显示连接状态：connecting、connected、error、ended。
- 控制 AI 回复长度和角色行为。

验收：

- 面试场景可以进行 3 轮语音对话。
- 点餐场景 AI 不讲长篇教学，只扮演服务员。
- 断开或 API 失败时页面不崩。

风险：

- Realtime token 生成方式配置不对。
- 浏览器麦克风权限失败。
- 音频播放被浏览器自动播放策略拦截。
- AI 回复过长，延迟和成本上升。

兜底：

- 保留文字输入 fallback。
- 保留 mock conversation 模式。
- Realtime 失败时仍可演示总结页面。

### Phase 2：稳定转写和课后总结，Day 2 上午

目标：结束练习后能生成可信的学习报告。

任务：

- 收集用户 turn transcript。
- 实现 summary prompt。
- 要求模型返回结构化 JSON。
- 实现 JSON schema 校验或轻量校验。
- 生成分项评分、纠错、表达优化、复练任务。
- 报告页展示 summary。

验收：

- 报告能引用用户原句。
- 纠错说明有中文解释。
- 分项评分合理，不只给一个总分。
- summary API 失败时展示 mock report。

风险：

- transcript 不稳定导致误纠。
- 模型输出不是合法 JSON。
- 总结太空泛。

兜底：

- prompt 中强制引用原句。
- 解析失败时做一次 repair，仍失败则 mock。
- UI 标记“AI feedback may be imperfect”。

### Phase 3：scripted 跟读发音评测，Day 2 下午

目标：补齐题目里的“发音评测”，但不冒险做自由对话音素级评分。

任务：

- 每个场景配置 2 条 pronunciationSentences。
- 报告页推荐 1 条跟读句子。
- 前端实现录音按钮和播放/重录。
- 后端实现 `POST /api/pronunciation/scripted`。
- 先实现 mock result。
- 如果时间允许，替换为 Azure Pronunciation Assessment 或 Speechace。

验收：

- 用户能看到 reference sentence。
- 用户能录一段跟读音频。
- 页面能展示 pronunciation、accuracy、fluency、completeness、prosody。
- 页面能指出 2-3 个 weak words。

风险：

- 发音评测服务账号、地区、音频格式配置消耗时间。
- 浏览器录音格式与 provider 不兼容。

兜底：

- mock 发音评测永远保留。
- UI 写成真实结果和 mock 结果同结构。

### Phase 4：集成、QA 和演示脚本，Day 3

目标：把 demo 从“能跑”变成“能交付”。

任务：

- 打通完整路径：选择场景 -> 语音对话 -> 结束 -> 报告 -> 跟读。
- 加载态、错误态、空状态。
- 麦克风权限提示。
- 成本控制：AI 单轮 2-3 句。
- 写 README 运行说明。
- 准备 2 分钟演示脚本。
- 用 gstack/browser 做本地 UI 流程 QA。

验收：

- 新机器按 README 能跑起来。
- API key 缺失时能进入 mock demo。
- Desktop viewport 不重叠。
- Mobile viewport 可以基本操作。
- 演示时即使实时语音失败，也能切 mock 展示完整赛题闭环。

## 7. 任务拆分清单

### 路线 A：Realtime Owner

| ID | 任务 | 优先级 | 交付物 |
|---|---|---:|---|
| R-01 | 建 `POST /api/realtime/session` | P0 | 返回 ephemeral token |
| R-02 | 写 WebRTC client helper | P0 | `connectRealtime()` |
| R-03 | 练习页麦克风授权 | P0 | 权限状态和错误提示 |
| R-04 | 场景 prompt 注入 | P0 | 面试/点餐/会议角色正确 |
| R-05 | Realtime event logging | P1 | transcript/event panel |
| R-06 | 断开和重连状态 | P1 | error/retry UI |
| R-07 | mock realtime mode | P1 | 无 key 也能演示 |

### 路线 B：Analysis Owner

| ID | 任务 | 优先级 | 交付物 |
|---|---|---:|---|
| A-01 | 建 Scenario/Session/Turn/Summary types | P0 | 共享类型 |
| A-02 | 建 3 个场景配置 | P0 | interview/order/meeting |
| A-03 | 收集 transcript | P0 | turns 数组 |
| A-04 | summary prompt + JSON 输出 | P0 | `SessionSummary` |
| A-05 | correction prompt | P0 | 结构化纠错 |
| A-06 | report UI 数据适配 | P0 | 报告页可渲染 |
| A-07 | scripted pronunciation mock | P0 | 发音评分卡 |
| A-08 | Azure/Speechace provider | P2 | 可选真实评测 |

### 集成任务

| ID | 任务 | 优先级 | 交付物 |
|---|---|---:|---|
| I-01 | 端到端 demo flow | P0 | 全流程可点击 |
| I-02 | README 运行说明 | P0 | 本地启动文档 |
| I-03 | `.env.example` | P0 | API key 配置说明 |
| I-04 | mock fallback switch | P0 | `NEXT_PUBLIC_DEMO_MODE` |
| I-05 | gstack/browser QA | P1 | 截图和问题清单 |
| I-06 | 演示脚本 | P1 | 2 分钟讲稿 |

## 8. 建议分工

如果只有两个人：

```text
开发者 1：产品体验 + 前端主流程 + 报告页
开发者 2：Realtime WebRTC + AI provider + 转写/总结接口
```

更细一点：

| 模块 | Owner | Reviewer |
|---|---|---|
| 场景选择 | 开发者 1 | 开发者 2 |
| 练习房间 UI | 开发者 1 | 开发者 2 |
| WebRTC/Realtime | 开发者 2 | 开发者 1 |
| Summary/Correction | 开发者 2 | 开发者 1 |
| Report UI | 开发者 1 | 开发者 2 |
| Pronunciation UI | 开发者 1 | 开发者 2 |
| Pronunciation API/mock | 开发者 2 | 开发者 1 |
| README/演示脚本 | 两人共同 | 两人共同 |

每天至少合并一次，不要等第三天才集成。

## 9. Prompt 和输出约束

### Realtime tutor prompt 约束

```text
You are an English speaking coach in the selected scenario.
Stay in role.
Keep every spoken response under 2-3 sentences.
Ask one question at a time.
Do not over-correct during the live conversation.
If the learner is stuck, give a short hint or rephrase the question.
```

按场景补充：

- 面试：追问项目经历、行为问题、反问机会。
- 点餐：菜单、规格、偏好、确认订单。
- 会议：状态同步、意见表达、澄清、下一步行动。

### Summary prompt 输出约束

必须返回 JSON：

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
  "goalCompletion": ["..."],
  "corrections": [
    {
      "type": "grammar",
      "severity": "medium",
      "original": "...",
      "corrected": "...",
      "explanationZh": "...",
      "betterExpression": "..."
    }
  ],
  "betterExpressions": ["..."],
  "pronunciationFocus": "...",
  "practiceTasks": ["..."]
}
```

约束：

- 每条纠错必须引用用户原句。
- 不要把所有句子都改写，只选最值得学的 3 条。
- 中文解释要短。
- 分数要和证据一致。

## 10. 环境变量

建议先建 `.env.example`：

```bash
OPENAI_API_KEY=
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_TEXT_MODEL=gpt-4.1-mini

AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=

NEXT_PUBLIC_DEMO_MODE=false
```

如果不用 Azure，发音评测走 mock 即可。

## 11. 验收清单

最终交付前检查：

- [ ] 可以选择面试、点餐、会议三个场景。
- [ ] 可以开始语音练习。
- [ ] AI 能按场景角色语音回复。
- [ ] 可以结束练习。
- [ ] 可以生成课后报告。
- [ ] 报告包含总分和 5 个分项分。
- [ ] 报告包含语法/表达纠错。
- [ ] 报告包含更自然表达。
- [ ] 报告包含发音重点。
- [ ] 可以进入跟读发音练习。
- [ ] 发音评测真实 provider 失败时有 mock。
- [ ] 无 API key 时仍可演示完整产品流。
- [ ] README 写明启动方式和环境变量。

## 12. 演示脚本建议

演示 2 分钟版本：

```text
1. 选择“产品经理面试”场景，难度 B1。
2. 点击开始练习，AI 扮演面试官。
3. 用户回答 2-3 轮问题。
4. 点击结束练习。
5. 展示课后报告：
   - 总分和分项分
   - 语法纠错
   - 更自然表达
   - 发音重点
6. 点击跟读练习，读一句面试表达。
7. 展示发音评分和 weak words。
```

讲解重点：

- 我们没有选择传统 `STT -> LLM -> TTS` 同步链路，因为延迟会影响真实对话。
- 实时对话使用 OpenAI Realtime WebRTC，保证自然交互。
- 纠错总结和发音评测走后置分析链路，保证反馈准确和可解释。
- 自由对话只给整体发音/流利度趋势，精细发音反馈放在 scripted 跟读里。

## 13. 风险和兜底

| 风险 | 影响 | 兜底 |
|---|---|---|
| Realtime API 接不通 | 无法实时语音演示 | mock conversation + 报告闭环 |
| 麦克风权限失败 | 用户不能说话 | 文字输入 fallback |
| transcript 不稳定 | 纠错误判 | 使用 final transcript，低置信不纠错 |
| LLM 输出 JSON 失败 | 报告页崩 | schema 校验 + repair + mock report |
| 发音评测接入慢 | 发音模块缺失 | scripted pronunciation mock |
| AI 回复太长 | 延迟高、成本高 | prompt 限制 2-3 句 |
| 两人分支冲突 | 集成拖延 | 每天至少合并一次 |

## 14. GStack 工作节奏

这里的 gstack 用法不是为了写更多流程，而是为了保证“做完整”：

- 每个阶段都有可验收结果。
- 每条链路都有 mock fallback。
- 每天都能集成一次。
- Day 3 使用浏览器 QA 检查完整用户路径。

建议节奏：

```text
Day 1 end：Realtime 链路 gstack/browser 冒烟测试
Day 2 end：报告和跟读链路 gstack/browser 冒烟测试
Day 3 mid：桌面 + 移动 viewport QA
Day 3 final：按演示脚本完整跑一遍
```

## 15. 最小成功标准

如果时间被压缩，最低也要保住这条路径：

```text
场景选择
  -> 实时或 mock 语音对话
  -> 结束练习
  -> 课后纠错总结
  -> 跟读发音评分
```

只要这个闭环稳，赛题核心就成立。
