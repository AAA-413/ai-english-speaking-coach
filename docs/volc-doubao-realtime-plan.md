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
- 已接入火山 RTC OpenAPI HMAC-SHA256 签名。
- `/api/realtime/session` 会在服务端调用 `StartVoiceChat`。
- `/api/realtime/session/:id/stop` 会调用 `StopVoiceChat`。
- smoke test 已覆盖真实 Start 后自动 Stop，避免后台会话残留。
- `AgentConfig.TargetUserId` 按火山接口要求使用数组。

## 3. 需要本地配置

不要把真实值提交到 GitHub。放在本地 `.env`：

```bash
REALTIME_PROVIDER=volc_doubao

VOLC_DOUBAO_MODEL=1.2.1.1
VOLC_RTC_APP_ID=
VOLC_RTC_APP_KEY=
VOLC_RTC_CLIENT_TOKEN=
VOLC_RTC_WEB_SDK_URL=https://lf-unpkg.volccdn.com/obj/vcloudfe/sdk/@volcengine/rtc/4.68.4/1778142355039/index.min.js
VOLC_RTC_TOKEN_TTL_SECONDS=86400
VOLC_RTC_ROOM_ID_PREFIX=english_coach
VOLC_RTC_BUSINESS_ID=ai_english_speaking_coach
VOLC_RTC_OPENAPI_HOST=rtc.volcengineapi.com
VOLC_RTC_OPENAPI_REGION=cn-north-1
VOLC_RTC_OPENAPI_VERSION=2024-12-01
VOLC_RTC_START_VOICE_CHAT_ENABLED=true
VOLCENGINE_ACCESS_KEY_ID=
VOLCENGINE_SECRET_ACCESS_KEY=
VOLC_DOUBAO_S2S_APP_ID=
VOLC_DOUBAO_S2S_TOKEN=
```

你拿到的 S2S AppID 应放在：

```bash
VOLC_DOUBAO_S2S_APP_ID=your_s2s_app_id
```

还需要从火山控制台拿：

- `VOLC_RTC_APP_ID`
- `VOLC_RTC_APP_KEY`
- `VOLC_DOUBAO_S2S_TOKEN`
- 火山账号 OpenAPI AK/SK：`VOLCENGINE_ACCESS_KEY_ID` 和 `VOLCENGINE_SECRET_ACCESS_KEY`

`VOLC_RTC_CLIENT_TOKEN` 不建议长期手填。现在代码会优先用 `VOLC_RTC_APP_ID + VOLC_RTC_APP_KEY + roomId + userId` 为每个 session 动态生成房间级 token；手填 `VOLC_RTC_CLIENT_TOKEN` 只作为临时覆盖。注意官方 RTC token 示例里的 RTC AppID 是 24 位，如果控制台拿到的是较短数字 ID，需要回到 RTC 应用管理页确认真正用于 SDK/token 的 AppID。

`VOLC_RTC_WEB_SDK_URL` 默认使用官方 `@volcengine/rtc@4.68.4` CDN。通常不需要手动配置；只有需要锁定其他版本或走自建静态资源时才覆盖。

## 4. 当前还差什么

浏览器 RTC SDK adapter 已经接入官方 Web SDK CDN：如果 session 返回 `clientToken`，且前端能加载 `@volcengine/rtc` 注册的 `window.VERTC`，会尝试执行：

```text
createEngine(appId)
  -> getUserMedia(audio)
  -> joinRoom(clientToken, roomId, { userId }, roomConfig)
```

如果 SDK 或 token 缺失，会自动回到 mock conversation，不影响演示。

后端已经具备 RTC client token 生成能力；如果 `VOLC_RTC_APP_ID` 长度不符合官方 token 格式，`/api/health` 会在 `volcDoubao.tokenConfigInvalid` 中提示。

服务端正式调用 `StartVoiceChat` 的签名/鉴权已经通过本地真实 smoke：

```text
StartVoiceChat -> ok
StopVoiceChat  -> ok
```

下一步需要：

1. 浏览器真人麦克风加入 RTC 房间，确认能听到豆包回复。
2. 确认火山字幕/消息事件的实际 payload 形状。
3. 如果事件名或字段与当前兼容解析不一致，按真实 payload 微调 `handleVolcRtcMessage`。
4. 把确认后的字幕/转写事件稳定写入 `turns`，复用现有 summary 和 report。
5. 录一版完整 demo 视频。

## 5. 演示策略

三天赛题里建议保持双路线：

```text
OpenAI Realtime：备用实时语音主线
Doubao O2.0：国内低成本实时语音主线，服务端 Start/Stop 已通
Mock：最终演示兜底
```

如果浏览器真人 RTC 对话还有兼容问题，就先用 mock/文字流程录 demo，再补火山字幕事件适配。
