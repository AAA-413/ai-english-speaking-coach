import test from "node:test";
import assert from "node:assert/strict";
import {
  createVolcDoubaoRealtimeSession,
  volcDoubaoHealth,
} from "../lib/volc-doubao-realtime.mjs";
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
  assert.equal(session.sdkUrl, "https://example.test/vertc.js");
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
  assert.deepEqual(health.missing, ["VOLC_RTC_APP_ID", "VOLC_DOUBAO_S2S_TOKEN"]);
  assert.deepEqual(health.clientMissing, ["VOLC_RTC_CLIENT_TOKEN or valid VOLC_RTC_APP_KEY"]);
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
