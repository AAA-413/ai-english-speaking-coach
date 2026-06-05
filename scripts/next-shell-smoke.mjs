import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const requiredFiles = [
  "apps/web-next/package.json",
  "apps/web-next/next.config.mjs",
  "apps/web-next/tsconfig.json",
  "apps/web-next/src/app/page.tsx",
  "apps/web-next/src/app/api/scenarios/route.ts",
  "apps/web-next/src/shared/practice.ts",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const filePath of requiredFiles) {
  assert(existsSync(path.join(rootDir, filePath)), `Missing ${filePath}`);
}

const nextPackage = JSON.parse(
  readFileSync(path.join(rootDir, "apps/web-next/package.json"), "utf8"),
);

for (const dependency of ["next", "react", "react-dom"]) {
  assert(
    nextPackage.dependencies?.[dependency],
    `apps/web-next/package.json must depend on ${dependency}`,
  );
}

for (const dependency of ["typescript", "@types/node", "@types/react", "@types/react-dom"]) {
  assert(
    nextPackage.devDependencies?.[dependency],
    `apps/web-next/package.json must include dev dependency ${dependency}`,
  );
}

const practiceContracts = readFileSync(
  path.join(rootDir, "apps/web-next/src/shared/practice.ts"),
  "utf8",
);

for (const exportedName of [
  "ScenarioId",
  "PracticeTurn",
  "SessionSummary",
  "PronunciationAssessment",
]) {
  assert(
    practiceContracts.includes(exportedName),
    `practice contracts must include ${exportedName}`,
  );
}

const pageSource = readFileSync(
  path.join(rootDir, "apps/web-next/src/app/page.tsx"),
  "utf8",
);

assert(
  pageSource.includes("AI English Speaking Coach"),
  "Next shell page must render the app name",
);

console.log("Next.js shell smoke checks passed");
