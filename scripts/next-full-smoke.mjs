import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const requiredFiles = [
  "apps/web-next/src/app/page.tsx",
  "apps/web-next/src/app/api/health/route.ts",
  "apps/web-next/src/app/api/scenarios/route.ts",
  "apps/web-next/src/app/api/realtime/session/route.ts",
  "apps/web-next/src/app/api/sessions/[id]/summary/route.ts",
  "apps/web-next/src/app/api/sessions/[id]/transcribe/route.ts",
  "apps/web-next/src/app/api/pronunciation/scripted/route.ts",
  "apps/web-next/src/components/ScenarioPicker.tsx",
  "apps/web-next/src/components/PracticeRoom.tsx",
  "apps/web-next/src/components/SessionReport.tsx",
  "apps/web-next/src/components/PronunciationPanel.tsx",
  "apps/web-next/src/components/EventLog.tsx",
  "apps/web-next/src/hooks/usePracticeSession.ts",
  "apps/web-next/src/hooks/usePronunciationRecorder.ts",
  "apps/web-next/src/lib/api-client.ts",
  "apps/web-next/src/lib/session-export.ts",
  "apps/web-next/src/server/analysis.ts",
  "apps/web-next/src/server/realtime.ts",
  "apps/web-next/src/server/pronunciation.ts",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const filePath of requiredFiles) {
  assert(existsSync(path.join(rootDir, filePath)), `Missing ${filePath}`);
}

const pageSource = readFileSync(path.join(rootDir, "apps/web-next/src/app/page.tsx"), "utf8");
for (const text of [
  "ScenarioPicker",
  "PracticeRoom",
]) {
  assert(pageSource.includes(text), `page.tsx must wire ${text}`);
}

const practiceRoomSource = readFileSync(
  path.join(rootDir, "apps/web-next/src/components/PracticeRoom.tsx"),
  "utf8",
);
assert(practiceRoomSource.includes("SessionReport"), "PracticeRoom must wire SessionReport");

const sessionReportSource = readFileSync(
  path.join(rootDir, "apps/web-next/src/components/SessionReport.tsx"),
  "utf8",
);
assert(sessionReportSource.includes("PronunciationPanel"), "SessionReport must wire PronunciationPanel");

const practiceHook = readFileSync(
  path.join(rootDir, "apps/web-next/src/hooks/usePracticeSession.ts"),
  "utf8",
);
for (const text of [
  "startPractice",
  "endPractice",
  "sendTypedTurn",
  "exportSessionJson",
  "realtimeProvider",
]) {
  assert(practiceHook.includes(text), `usePracticeSession must expose ${text}`);
}

const apiClient = readFileSync(path.join(rootDir, "apps/web-next/src/lib/api-client.ts"), "utf8");
for (const route of [
  "/api/realtime/session",
  "/api/pronunciation/scripted",
  "/summary",
  "/transcribe",
]) {
  assert(apiClient.includes(route), `api-client must call ${route}`);
}

console.log("Full Next.js TypeScript refactor smoke checks passed");
