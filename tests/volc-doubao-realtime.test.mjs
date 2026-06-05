import test from "node:test";
import assert from "node:assert/strict";
import {
  createVolcDoubaoRealtimeSession,
  DEFAULT_VOLC_RTC_WEB_SDK_URL,
  DEFAULT_VOLC_RTC_WEB_SDK_VERSION,
  startVolcDoubaoVoiceChat,
  stopVolcDoubaoVoiceChat,
  volcDoubaoHealth,
} from "../lib/volc-doubao-realtime.mjs";
import {
  signVolcOpenApiRequest,
  volcOpenApiHealth,
} from "../lib/volc-openapi.mjs";
import {
  createVolcRtcClientToken,
  VOLC_RTC_TOKEN_VERSION,
} from "../lib/volc-rtc-token.mjs";
import { scenarios } from "../lib/scenarios.mjs";

const scenario = scenarios.find((item) => item.id === "job_interview");

test("createVolcDoubaoRealtimeSession builds Doubao O2.0 StartVoiceChat config", () => {
  const session = createVolcDoubaoRealtimeSession({
    scenario,
    level: "B1",
    correctionMode: "post_session",
    sessionId: "sess_test",
    env: {
      VOLC_RTC_APP_ID: "rtc-app-id",
      VOLC_RTC_CLIENT_TOKEN: "client-token",
      VOLC_RTC_WEB_SDK_URL: "https://example.test/vertc.js",
      VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
      VOLC_DOUBAO_S2S_TOKEN: "secret-token",
      VOLC_DOUBAO_MODEL: "1.2.1.1",
    },
  });

  assert.equal(session.provider, "volc_doubao");
  assert.equal(session.model, "1.2.1.1");
  assert.equal(session.clientToken, "client-token");
  assert.equal(session.startVoiceChatPayload.AppId, "rtc-app-id");
  assert.equal(session.startVoiceChatPayload.TaskId, "task_sess_test");
  assert.deepEqual(session.startVoiceChatPayload.AgentConfig.TargetUserId, [session.userId]);
  assert.equal(session.sdkUrl, "https://example.test/vertc.js");
  assert.equal(session.sdkSource, "custom_url");
  assert.equal(session.sdkVersion, DEFAULT_VOLC_RTC_WEB_SDK_VERSION);
  assert.equal(session.startVoiceChatPayload.Config.S2SConfig.Provider, "volcano");
  assert.equal(
    session.startVoiceChatPayload.Config.S2SConfig.ProviderParams.dialog.extra.model,
    "1.2.1.1",
  );
  assert.equal(
    session.startVoiceChatPayload.Config.S2SConfig.ProviderParams.app.appid,
    "test-s2s-app-id",
  );
  assert.match(
    session.startVoiceChatPayload.Config.S2SConfig.ProviderParams.dialog.system_role,
    /Product Manager Interview/,
  );
});

test("createVolcDoubaoRealtimeSession generates RTC client token from AppKey", () => {
  const session = createVolcDoubaoRealtimeSession({
    scenario,
    level: "B1",
    correctionMode: "post_session",
    sessionId: "sess_test",
    env: {
      VOLC_RTC_APP_ID: "123456781234567812345678",
      VOLC_RTC_APP_KEY: "test-app-key",
      VOLC_RTC_WEB_SDK_URL: "https://example.test/vertc.js",
      VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
      VOLC_DOUBAO_S2S_TOKEN: "secret-token",
      VOLC_DOUBAO_MODEL: "1.2.1.1",
    },
  });

  assert.match(session.clientToken, /^001123456781234567812345678/);
  assert.equal(session.clientToken.length > VOLC_RTC_TOKEN_VERSION.length + 24, true);
});

test("createVolcDoubaoRealtimeSession uses official Volc RTC Web SDK CDN by default", () => {
  const session = createVolcDoubaoRealtimeSession({
    scenario,
    level: "B1",
    correctionMode: "post_session",
    sessionId: "sess_test",
    env: {
      VOLC_RTC_APP_ID: "123456781234567812345678",
      VOLC_RTC_APP_KEY: "test-app-key",
      VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
      VOLC_DOUBAO_S2S_TOKEN: "secret-token",
      VOLC_DOUBAO_MODEL: "1.2.1.1",
    },
  });

  assert.equal(session.sdkUrl, DEFAULT_VOLC_RTC_WEB_SDK_URL);
  assert.equal(session.sdkSource, "official_cdn");
  assert.equal(session.sdkVersion, DEFAULT_VOLC_RTC_WEB_SDK_VERSION);
});

test("createVolcRtcClientToken creates deterministic RTC token payload", () => {
  const token = createVolcRtcClientToken({
    appId: "123456781234567812345678",
    appKey: "test-app-key",
    roomId: "room_a",
    userId: "user_a",
    ttlSeconds: 3600,
    nowSeconds: 1_700_000_000,
    nonce: 42,
  });

  assert.equal(
    token,
    "001123456781234567812345678PAAqAAAAAPFTZRD/U2UGAHJvb21fYQYAdXNlcl9hBQAAABD/U2UBABD/U2UCABD/U2UDABD/U2UEABD/U2UgAOqeDD8uqGKWTHW3inxcy//HPg0dmihkOjyYAWtIsbsd",
  );
});

test("volcDoubaoHealth reports missing realtime fields", () => {
  const health = volcDoubaoHealth({
    VOLC_DOUBAO_MODEL: "1.2.1.1",
    VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
  });

  assert.equal(health.model, "1.2.1.1");
  assert.equal(health.ready, false);
  assert.equal(health.clientReady, false);
  assert.equal(health.serverReady, false);
  assert.equal(health.hasRtcWebSdkUrl, true);
  assert.equal(health.usesDefaultRtcWebSdk, true);
  assert.equal(health.rtcWebSdkVersion, DEFAULT_VOLC_RTC_WEB_SDK_VERSION);
  assert.deepEqual(health.missing, ["VOLC_RTC_APP_ID", "VOLC_DOUBAO_S2S_TOKEN"]);
  assert.deepEqual(health.clientMissing, ["VOLC_RTC_CLIENT_TOKEN or valid VOLC_RTC_APP_KEY"]);
  assert.deepEqual(health.serverMissing, ["VOLCENGINE_ACCESS_KEY_ID", "VOLCENGINE_SECRET_ACCESS_KEY"]);
});

test("volcDoubaoHealth reports invalid short RTC app id for generated token", () => {
  const health = volcDoubaoHealth({
    VOLC_DOUBAO_MODEL: "1.2.1.1",
    VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
    VOLC_DOUBAO_S2S_TOKEN: "secret-token",
    VOLC_RTC_APP_ID: "2636127738",
    VOLC_RTC_APP_KEY: "test-app-key",
  });

  assert.equal(health.ready, true);
  assert.equal(health.canGenerateClientToken, false);
  assert.equal(health.clientReady, false);
  assert.deepEqual(health.clientMissing, ["VOLC_RTC_CLIENT_TOKEN or valid VOLC_RTC_APP_KEY"]);
  assert.deepEqual(health.tokenConfigInvalid, ["VOLC_RTC_APP_ID must be 24 characters"]);
});

test("volcOpenApiHealth reports configured signing credentials without exposing values", () => {
  const health = volcOpenApiHealth({
    VOLCENGINE_ACCESS_KEY_ID: "ak",
    VOLCENGINE_SECRET_ACCESS_KEY: "sk",
  });

  assert.equal(health.service, "rtc");
  assert.equal(health.host, "rtc.volcengineapi.com");
  assert.equal(health.ready, true);
  assert.equal(health.hasAccessKeyId, true);
  assert.equal(health.hasSecretAccessKey, true);
  assert.deepEqual(health.missing, []);
});

test("signVolcOpenApiRequest signs StartVoiceChat with RTC query parameters", () => {
  const signed = signVolcOpenApiRequest({
    action: "StartVoiceChat",
    payload: { AppId: "app", RoomId: "room", TaskId: "task" },
    config: {
      accessKeyId: "AK_TEST",
      secretAccessKey: "SK_TEST",
      region: "cn-north-1",
      host: "rtc.volcengineapi.com",
      version: "2024-12-01",
      protocol: "https",
    },
    now: new Date("2026-06-05T00:00:00.000Z"),
  });

  assert.equal(
    signed.url,
    "https://rtc.volcengineapi.com/?Action=StartVoiceChat&Version=2024-12-01",
  );
  assert.equal(signed.headers["X-Date"], "20260605T000000Z");
  assert.equal(signed.signedHeaders, "host;x-content-sha256;x-date");
  assert.match(signed.headers.Authorization, /^HMAC-SHA256 Credential=AK_TEST\/20260605\/cn-north-1\/rtc\/request/);
  assert.equal(signed.body, '{"AppId":"app","RoomId":"room","TaskId":"task"}');
});

test("startVolcDoubaoVoiceChat calls StartVoiceChat through signed OpenAPI", async () => {
  const session = createVolcDoubaoRealtimeSession({
    scenario,
    level: "B1",
    correctionMode: "post_session",
    sessionId: "sess_test",
    env: {
      VOLC_RTC_APP_ID: "123456781234567812345678",
      VOLC_RTC_APP_KEY: "test-app-key",
      VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
      VOLC_DOUBAO_S2S_TOKEN: "secret-token",
      VOLC_DOUBAO_MODEL: "1.2.1.1",
    },
  });
  const calls = [];
  const result = await startVolcDoubaoVoiceChat({
    session,
    env: {
      VOLC_RTC_APP_ID: "123456781234567812345678",
      VOLCENGINE_ACCESS_KEY_ID: "ak",
      VOLCENGINE_SECRET_ACCESS_KEY: "sk",
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ResponseMetadata: { RequestId: "req_start" } }), { status: 200 });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "started");
  assert.equal(result.requestId, "req_start");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /Action=StartVoiceChat/);
  assert.match(calls[0].init.headers.Authorization, /^HMAC-SHA256/);
  assert.equal(JSON.parse(calls[0].init.body).Config.S2SConfig.ProviderParams.app.token, "secret-token");
});

test("stopVolcDoubaoVoiceChat calls StopVoiceChat with task identifiers", async () => {
  const calls = [];
  const result = await stopVolcDoubaoVoiceChat({
    roomId: "room_test",
    taskId: "task_test",
    env: {
      VOLC_RTC_APP_ID: "123456781234567812345678",
      VOLCENGINE_ACCESS_KEY_ID: "ak",
      VOLCENGINE_SECRET_ACCESS_KEY: "sk",
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ResponseMetadata: { RequestId: "req_stop" } }), { status: 200 });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "stopped");
  assert.match(calls[0].url, /Action=StopVoiceChat/);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    AppId: "123456781234567812345678",
    RoomId: "room_test",
    TaskId: "task_test",
  });
});
