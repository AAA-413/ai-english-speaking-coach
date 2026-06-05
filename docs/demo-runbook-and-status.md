# 演示 Runbook 与当前进度

更新时间：2026-06-05

这份文档给最后三天冲刺使用，主要回答三个问题：

- 现在做到哪个阶段了？
- 今天能稳定演示什么？
- 提交前还差哪些事情？

## 1. 当前阶段

我们现在已经进入 **Phase 4：集成、QA 和演示打磨**。

产品已经有完整的端到端演示闭环：

```text
选择场景
  -> 开始练习
  -> Realtime WebRTC 或 mock 对话
  -> 结束练习
  -> 生成课后报告
  -> scripted 跟读发音评测
  -> 导出 JSON 调试数据
```

最稳的演示路径不依赖任何外部 API key。真实 provider 是加分项，不是唯一演示路径。

## 2. 阶段状态

| 阶段 | 名称 | 状态 | 说明 |
|---|---|---|---|
| Phase 0 | 项目框架和契约 | 已完成 | 无依赖 Node 应用、场景数据、API contract、文档、mock fallback 都已具备。 |
| Phase 1 | 实时对话链路 | 代码就绪，需真实 key QA | 已有 `POST /api/realtime/session`、WebRTC helper、事件日志、麦克风处理、mock fallback。最终演示前要用真实 OpenAI key 跑一次。 |
| Phase 2 | 稳定转写和课后总结 | 基本完成 | 已有 OpenAI summary provider、transcription endpoint、结构化报告 UI、mock fallback。还需要真实 key 下的转写/总结冒烟测试。 |
| Phase 3 | scripted 跟读发音评测 | 基本完成 | 已有浏览器录音 payload、评分卡、Azure REST provider、provider 诊断、JSON export。还需要 Azure key + 兼容音频格式实测。 |
| Phase 4 | 集成、QA、演示脚本 | 进行中 | API smoke、桌面浏览器 smoke、移动端 smoke、导出 JSON、麦克风拒绝 fallback 已测。剩余真实 key QA 和最终演示彩排。 |

## 3. 已实现内容

### 路线 A：实时对话

- 场景选择：面试、点餐、会议。
- 练习房间：状态、事件日志、文字 mock 输入、导出。
- 后端 Realtime client secret endpoint。
- 前端 WebRTC 连接 helper。
- Realtime transcript event 处理。
- Realtime 失败时释放资源并 fallback。
- 未配置 `OPENAI_API_KEY` 时自动进入 mock mode。

### 路线 B：反馈、转写、发音

- 课后 summary endpoint。
- OpenAI Responses summary provider。
- mock summary fallback。
- transcription endpoint，接受 `audioBase64` 和 `mimeType`。
- scripted pronunciation endpoint。
- Azure Pronunciation Assessment provider。
- mock pronunciation fallback。
- 发音评分卡展示 provider/source 和 fallback 原因。
- Export JSON 包含 summary、turns、event log、pronunciation audio metadata 和 `pronunciationResult`。

## 4. 稳定演示路径

两分钟演示建议按这条路径走：

1. 打开 `http://localhost:3000`。
2. 选择 **Product Manager Interview**。
3. 点击 **Start Practice**。
4. 如果没有配置 Realtime，用文字 mock 输入：
   `I am work as product manager for three years.`
5. 点击 **Send Turn**。
6. 点击 **End**。
7. 展示课后报告：
   - overall score
   - five sub-scores
   - grammar/expression correction
   - practice tasks
8. 点击 Scripted pronunciation 里的 **Score**，展示 fallback 评分卡。
9. 如果麦克风可用，点击 **Record**，读推荐句子，再停止。
10. 点击 **Export JSON**，说明这里包含完整学习轨迹，方便路线 B 调试。

## 5. 演示讲解重点

- 我们把系统拆成两条路线。
- 路线 A 用 OpenAI Realtime + WebRTC 做低延迟自然对话。
- 路线 B 做稳定 transcript、纠错、课后总结、scripted 发音评测。
- 实时对话中不频繁打断纠错，因为这会影响开口流畅度和用户信心。
- 细粒度发音反馈放在 scripted 跟读里，因为 reference text 已知，评测更可靠。
- 所有外部 provider 都有 mock fallback，所以 API key、麦克风权限或网络失败时，演示不会断。

## 6. 提交前剩余工作

### 必须完成

- 真实 OpenAI key QA：
  - 配置 `OPENAI_API_KEY`
  - 创建 Realtime session
  - 浏览器授权麦克风
  - 跑一小段真实语音对话
  - 结束后生成 summary
- 最终彩排：
  - mock mode 完整跑一次
  - 如果有 key，真实 provider 跑一次
  - 准备好 fallback 句子和文字输入内容

### 可选加分

- 把浏览器 WebM 录音转成 WAV/OGG 再传 Azure REST，或改用 Azure Speech SDK。
- 给 OpenAI summary JSON 加 schema validation/repair。
- 保存一份导出的 session JSON 样本。
- header 加一个 mock / real provider 的更明显视觉标记。
- 如果最终提交需要公网链接，再补部署说明。

## 7. 建议分工

| Owner | 重点 | 任务 |
|---|---|---|
| 你 | 前端 + 路线 A 演示 | Realtime QA、演示彩排、UI polish。 |
| 队友 | 路线 B provider 质量 | 真实转写测试、Azure 发音测试、summary prompt 调优、导出 JSON 检查。 |

现在两条路线已经基本互不阻塞。前端继续改 UI 时，尽量不要改 provider contract，除非和路线 B 约定好。

## 8. 最终检查清单

- [x] 可以选择面试、点餐、会议三个场景。
- [x] 可以开始练习。
- [x] 无 API key 时可以进入 mock mode。
- [x] 可以收集 turns。
- [x] 可以结束练习并生成报告。
- [x] 报告有总分和 5 个分项分。
- [x] 报告有语法/表达纠错。
- [x] 报告有练习任务。
- [x] 有 scripted pronunciation 评分卡。
- [x] 发音 provider 失败时能 fallback mock。
- [x] Export JSON 包含 turns、summary、events、pronunciation result。
- [x] API smoke test 本地通过。
- [x] 桌面浏览器 smoke test 本地通过。
- [x] 390px 移动端 viewport QA 通过。
- [ ] 真实 OpenAI Realtime key 测试。
- [ ] 真实 Azure pronunciation key 测试。
- [ ] 最终两分钟彩排。

## 9. 最近一次本地验证

2026-06-05 已通过：

- `node --check public/app.js && node --check server.mjs && node scripts/smoke-test.mjs`
- 桌面 Playwright smoke：开始练习、发送 mock turn、结束、发音评分、导出 JSON。
- 移动端 Playwright smoke：`390x844` 视口，场景选择、练习、报告、发音评分可用，无横向溢出。
- 麦克风拒绝 Playwright smoke：录音失败时自动 fallback 到无音频评分。

