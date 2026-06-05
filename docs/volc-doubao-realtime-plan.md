# Volc Doubao Realtime Integration Plan

更新时间：2026-06-05

## 1. 当前选择

端到端实时语音模型：

```text
Doubao O2.0
model = 1.2.1.1
```

项目新增 provider：

```bash
REALTIME_PROVIDER=volc_doubao
```

## 2. 已完成

- 后端支持 `REALTIME_PROVIDER=openai | volc_doubao | mock`。
- `/api/health` 返回豆包配置状态。
- `/api/realtime/session` 在 `volc_doubao` 模式下构造 StartVoiceChat 配置。
- StartVoiceChat 配置中使用：
  - `S2SConfig.Provider = volcano`
  - `ProviderParams.dialog.extra.model = 1.2.1.1`
  - 场景 prompt 注入 `system_role`
  - `SubtitleConfig.SubtitleMode = 1`
- 浏览器响应中会隐藏 `VOLC_DOUBAO_S2S_TOKEN`，不把 token 暴露给前端。
- 前端新增 Realtime provider 选择。
- 如果豆包配置不完整，自动 fallback 到 mock conversation。

## 3. 需要本地配置

不要把真实值提交到 GitHub。放在本地 `.env`：

```bash
REALTIME_PROVIDER=volc_doubao

VOLC_DOUBAO_MODEL=1.2.1.1
VOLC_RTC_APP_ID=
VOLC_RTC_CLIENT_TOKEN=
VOLC_RTC_WEB_SDK_URL=
VOLC_RTC_ROOM_ID_PREFIX=english_coach
VOLC_RTC_BUSINESS_ID=ai_english_speaking_coach
VOLC_DOUBAO_S2S_APP_ID=
VOLC_DOUBAO_S2S_TOKEN=
```

你拿到的 S2S AppID 应放在：

```bash
VOLC_DOUBAO_S2S_APP_ID=your_s2s_app_id
```

还需要从火山控制台拿：

- `VOLC_RTC_APP_ID`
- `VOLC_RTC_CLIENT_TOKEN`
- `VOLC_RTC_WEB_SDK_URL`，或在页面里预加载能提供 `window.VERTC` 的 SDK
- `VOLC_DOUBAO_S2S_TOKEN`

## 4. 还未完成

这次改造已经有浏览器 RTC SDK adapter：如果 session 返回 `clientToken`，且前端能通过 `VOLC_RTC_WEB_SDK_URL` 或 `window.VERTC` 加载火山 RTC SDK，会尝试执行：

```text
createEngine(appId)
  -> getUserMedia(audio)
  -> joinRoom(clientToken, roomId, { userId }, roomConfig)
```

如果 SDK 或 token 缺失，会自动回到 mock conversation，不影响演示。

仍然需要确认火山控制台生成 token 的方式，以及服务端正式调用 StartVoiceChat 的签名/鉴权。

下一步需要：

1. 从火山控制台或服务端生成用户加入 RTC 房间所需的 `VOLC_RTC_CLIENT_TOKEN`。
2. 填入 `VOLC_RTC_WEB_SDK_URL` 或改为正式 npm/Next.js SDK 集成。
3. 后端服务端调用 `StartVoiceChat`。
4. 用户和智能体在同一个房间实时语音对话。
5. 结束时调用 `StopVoiceChat`。
6. 把字幕/转写事件写入 `turns`，复用现有 summary 和 report。

## 5. 演示策略

三天赛题里建议保持双路线：

```text
OpenAI Realtime：已接入的完整实时语音主线
Doubao O2.0：国内低成本实时语音备选路线
Mock：最终演示兜底
```

如果 OpenAI 支付或额度卡住，就继续推进 Doubao RTC SDK 接入。
