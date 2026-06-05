# AI 英语口语陪练：三天冲刺对齐文档

整理日期：2026-06-05  
目标读者：项目队友  
当前仓库：https://github.com/AAA-413/ai-english-speaking-coach

## 1. 当前项目状态

- 仓库已创建：`AAA-413/ai-english-speaking-coach`
- 仓库可见性：Private
- 队友 `bei-shan` 已加入，权限为 `write`
- `main` 分支保护规则已创建，但 GitHub 个人私有仓库免费版显示 `Not enforced`
- 因此三天内采用团队约定：不要直接 push `main`，功能开发走 branch + pull request

推荐协作命令：

```bash
git checkout main
git pull
git checkout -b feat/your-feature

# 开发后
git add .
git commit -m "Describe your change"
git push -u origin feat/your-feature
```

然后在 GitHub 上开 Pull Request，另一个人 review 后合并。

## 2. 题目要求拆解

题目要做的是一款英语口语练习工具，核心不是普通聊天，而是“指定场景下的真实对话训练”。

必须覆盖：

- 场景选择：面试、点餐、会议等
- 实时语音对话：用户能直接说，AI 能语音回答
- 发音评测：至少给出可解释的发音/流利度反馈
- 语法和表达纠错：指出用户原句问题，给出更自然表达
- 课后总结：分数、问题、建议、复练任务
- 量化反馈：让用户知道自己哪里进步、哪里需要练

三天内不要做：

- 完整账号系统
- 长期历史记录和 7/30 天趋势
- 复杂数据库、队列、对象存储
- 移动端
- 企业课堂/教师后台
- 官方 CEFR 认证评分

## 3. 调研结论：选择混合双链路

队友调研文档里推荐的是方案 C：混合双链路。

核心思想：

```text
实时对话链路：负责快、自然、可打断
课后分析链路：负责准、可解释、可量化
```

不要把所有事情都塞进同一条链路。

### 为什么不是传统流水线

传统方案：

```text
用户语音 -> STT -> LLM -> TTS -> 播放
```

问题是延迟高。用户说完后要等转写、等 LLM、等 TTS，真实对话会有明显停顿。

### 为什么不是纯实时模型

纯实时方案：

```text
用户语音 -> 实时语音模型 -> AI 语音回复
```

优点是自然、低延迟。缺点是对稳定转写、纠错证据链、发音细粒度评分不够可控。

### 推荐方案

```text
实时练习：
用户语音 -> WebRTC -> OpenAI Realtime -> AI 语音回答

课后分析：
用户音频/稳定 transcript -> STT/LLM/发音评测 -> 纠错、评分、总结
```

一句话：实时链路负责自然对话，分析链路负责学习反馈。

## 4. WebRTC 和 OpenAI Realtime 是什么

### WebRTC

WebRTC 不是 AI，它是浏览器原生支持的实时音视频通信技术。

它负责：

- 获取麦克风音频
- 低延迟传输音频
- 接收 AI 返回的音频
- 支持双向实时通信
- 支持打断、实时播放、连接状态管理

可以把 WebRTC 理解成“电话线路”。

### OpenAI Realtime

OpenAI Realtime 是实时语音模型服务。

它负责：

- 听用户说话
- 判断用户什么时候说完
- 理解用户内容
- 用模型生成回答
- 直接生成 AI 语音返回

所以用户说完话后当然需要 LLM，只是这个 LLM 已经包含在 Realtime 模型内部，不需要我们手写一条 `STT -> Chat LLM -> TTS` 的同步链路。

可以理解为：

```text
WebRTC = 语音传输通道
OpenAI Realtime = 会听、会想、会说的实时 AI
LLM = OpenAI Realtime 内部的大脑
```

## 5. 三天 MVP 的语音链路设计

### 实时对话链路

```text
1. 用户选择场景、难度、纠错模式
2. 前端请求后端创建 session
3. 后端生成 OpenAI Realtime 临时 token
4. 前端用 WebRTC 连接 OpenAI Realtime
5. 用户用麦克风说话
6. Realtime 模型生成 AI 语音回复
7. 前端展示实时状态和对话记录
```

注意：主 API key 只能放后端，前端只能拿短期 token。

### 稳定转写链路

实时字幕只能用于展示，不适合直接做严肃纠错。

稳定转写建议这样做：

```text
用户每一轮发言开始 -> 创建 turnId
用户每一轮发言结束 -> 保存该 turn 音频
该 turn 音频 -> STT 模型 -> final transcript
final transcript -> 纠错/总结/评分
```

可选工具：

- OpenAI `gpt-4o-transcribe` / `gpt-4o-mini-transcribe`
- OpenAI `GPT-Realtime-Whisper`
- Deepgram STT
- MiMo ASR

三天内建议优先：

```text
OpenAI Realtime 做实时对话
OpenAI Transcribe 或 MiMo ASR 做稳定转写
```

如果实时转写和最终转写不一致，以最终转写为准。

## 6. 发音评测：优先做 scripted 跟读

不要一开始就对自由对话做音素级发音评分。自由对话没有标准答案，用户可以用很多种表达方式，强行做细粒度发音评测容易不稳定。

更稳的方式是 scripted pronunciation assessment，也就是跟读评测。

流程：

```text
1. 系统给用户一句固定英文
2. 用户照着读
3. 前端上传用户录音 + reference text
4. 后端调用发音评测服务
5. 返回 accuracy、fluency、completeness、prosody 等分数
6. 页面展示总分、薄弱单词、练习建议
```

示例：

```text
Reference text:
Could I get a medium latte with oat milk, please?
```

用户跟读后，可以评估：

- accuracy：发音准确度
- fluency：流利度
- completeness：有没有漏词
- prosody：语调、重音、节奏
- weak words：哪些单词读得不好

可选工具：

- Azure Pronunciation Assessment
- Speechace
- 自研 mock 评分兜底

三天内推荐：

```text
自由对话：给整体发音/流利度趋势
跟读句子：给更具体的发音评分
```

## 7. MiMo 是否适合

MiMo 可以作为候选能力，但不建议作为三天 MVP 的实时语音主链路。

适合用 MiMo 的地方：

- ASR：做稳定转写
- 文本 LLM：做语法纠错、表达优化、课后总结
- TTS：如果改走传统 `ASR -> LLM -> TTS` 流水线，可以尝试

不建议优先用 MiMo 的地方：

- 低延迟实时语音对话主链路
- 专业发音评测，尤其是 word/phoneme 级反馈

原因：

- 三天内自己部署或深度集成语音模型风险高
- 实时语音对话对延迟、打断、音频流稳定性要求很高
- 发音评测最好使用专门服务

推荐组合：

```text
实时对话：OpenAI Realtime WebRTC
稳定转写：OpenAI Transcribe / MiMo ASR / Deepgram
纠错总结：OpenAI / MiMo / Qwen / DeepSeek 文本模型
发音跟读：Azure Pronunciation Assessment / Speechace / mock 兜底
```

## 8. OpenAI Realtime 成本提醒

截至 2026-06-05，OpenAI 官方信息显示：

- GPT-Realtime-2 audio input：约 `$32 / 1M audio tokens`
- GPT-Realtime-2 cached audio input：约 `$0.40 / 1M audio tokens`
- GPT-Realtime-2 audio output：约 `$64 / 1M audio tokens`
- GPT-Realtime-Translate：约 `$0.034 / minute`
- GPT-Realtime-Whisper：约 `$0.017 / minute`

价格以官方页面为准，开发前需要再核一次：

- https://openai.com/api/pricing/
- https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/

三天 Demo 成本不是主要矛盾，但要控制 AI 回复长度。

建议系统提示词里限制：

```text
Keep each spoken response under 2-3 sentences.
Ask one question at a time.
Stay in the selected scenario role.
```

## 9. 三天开发计划

### Day 1：跑通实时对话

目标：先证明用户真的能和 AI 语音对话。

任务：

- 搭 React/Vite 或 Next.js 项目
- 做场景选择：面试、点餐、会议
- 做练习页：麦克风授权、开始/结束按钮、连接状态
- 后端生成 Realtime 临时 token
- 前端 WebRTC 接入 OpenAI Realtime
- AI 能按场景角色语音回答

验收：

- 能选场景
- 能开麦说话
- AI 能语音回复
- 可以结束练习

### Day 2：做纠错、总结、评分

目标：从“聊天 demo”变成“英语训练产品”。

任务：

- 保存对话 transcript
- 每轮用户发言生成 final transcript
- 调用文本模型生成结构化纠错
- 生成课后总结
- 生成分项评分：发音、流利度、语法、词汇、互动
- 做跟读发音评测入口，至少支持 mock 兜底

验收：

- 结束练习后能看到报告
- 报告引用用户原句
- 至少有 3 条纠错或表达优化
- 有分项评分和复练任务

### Day 3：产品化和演示兜底

目标：让演示稳定、完整、有产品感。

任务：

- UI polish
- loading / error / microphone permission 状态
- API 失败时展示 mock report
- 场景文案优化
- 准备演示脚本
- README 补充运行方式

验收：

- 演示全流程不依赖临场发挥
- 即使语音 API 出问题，也能用 mock 数据展示完整闭环
- 页面看起来像产品，不像接口测试页

## 10. 建议分工

如果两个人都用 vibe coding，代码速度不是问题，真正要防的是方向分散和集成翻车。

建议分工：

### A：产品体验和前端主流程

- 场景选择页
- 练习页布局
- 实时对话记录
- 课后总结页
- 分数卡片
- 纠错卡片
- 跟读评测 UI
- 演示兜底 mock 数据

### B：语音和 AI 链路

- Realtime token 后端接口
- WebRTC 连接
- Realtime session prompt
- transcript 收集
- 稳定转写
- 纠错总结 prompt
- 发音评测接口或 mock

每天至少集成一次，不要等到最后一天才合代码。

## 11. 最终交付形态

推荐最终 demo 流程：

```text
打开应用
  -> 选择场景：面试 / 点餐 / 会议
  -> 选择难度和纠错模式
  -> 开始实时语音对话
  -> AI 按场景扮演角色
  -> 用户完成 3-5 轮对话
  -> 点击结束练习
  -> 生成课后报告
  -> 展示纠错、表达优化、分项评分、复练任务
  -> 可选进入跟读发音练习
```

核心评价点：

- 不是普通聊天，而是场景化口语训练
- 不只是能说话，还能给学习反馈
- 不只给总分，而是有可解释的量化指标
- 实时链路和分析链路分开，技术方案合理

## 12. 一句话项目策略

三天内不要做“大而全的英语学习平台”，而是做一个完整闭环：

```text
场景化真实对话 + 实时语音交互 + 课后纠错总结 + 可量化反馈
```

语音部分采用混合双链路：

```text
OpenAI Realtime WebRTC 负责自然对话
稳定 transcript + LLM + 发音评测服务负责课后分析
```

这个方案既符合题目要求，也适合三天快速交付。
