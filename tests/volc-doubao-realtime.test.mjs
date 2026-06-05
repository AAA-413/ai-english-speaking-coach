import test from "node:test";
import assert from "node:assert/strict";
import {
  createVolcDoubaoRealtimeSession,
  volcDoubaoHealth,
} from "../lib/volc-doubao-realtime.mjs";
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
      VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
      VOLC_DOUBAO_S2S_TOKEN: "secret-token",
      VOLC_DOUBAO_MODEL: "1.2.1.1",
    },
  });

  assert.equal(session.provider, "volc_doubao");
  assert.equal(session.model, "1.2.1.1");
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

test("volcDoubaoHealth reports missing realtime fields", () => {
  const health = volcDoubaoHealth({
    VOLC_DOUBAO_MODEL: "1.2.1.1",
    VOLC_DOUBAO_S2S_APP_ID: "test-s2s-app-id",
  });

  assert.equal(health.model, "1.2.1.1");
  assert.equal(health.ready, false);
  assert.deepEqual(health.missing, ["VOLC_RTC_APP_ID", "VOLC_DOUBAO_S2S_TOKEN"]);
});
