# Next.js Parallel Migration Plan

Date: 2026-06-05
Branch: `feat/nextjs-migration-shell`

## Goal

Add a Next.js + TypeScript application shell in parallel with the current dependency-free Node demo.

This phase does not replace `server.mjs`, `public/index.html`, `public/app.js`, or `public/styles.css`. The existing demo remains the stable baseline while the new framework app grows behind a separate entry point.

## Why Parallel Migration

- Keeps the current demo stable for Route A and presentation work.
- Gives Route B a typed API contract for summary, transcription, correction, and pronunciation data.
- Lets the team migrate one surface at a time instead of rewriting the whole app at once.
- Makes framework adoption testable before it becomes the production path.

## Phase 1 Scope

1. Create `apps/web-next` as a standalone Next.js application.
2. Add TypeScript contracts for scenarios, turns, summaries, transcription, and pronunciation.
3. Add a small scenario API route in Next.js to prove the data contract works.
4. Add a usable first screen that lists the three practice scenarios and Route B status areas.
5. Add smoke checks and Next.js type/build verification.

## Non-Goals

- Do not remove or rewrite the current Node server.
- Do not migrate Realtime WebRTC behavior yet.
- Do not change provider behavior for OpenAI, Azure, DeepSeek, or mock fallback in this branch.
- Do not add authentication, database storage, or deployment-specific config.

## Directory Plan

```text
.
├── apps/
│   └── web-next/
│       ├── src/app/
│       ├── src/components/
│       ├── src/lib/
│       └── src/shared/
├── scripts/
│   └── next-shell-smoke.mjs
└── docs/
    └── nextjs-parallel-migration-plan.md
```

## Test Plan

Every step should have at least one check:

- Existing app stability: `npm run check` and `npm run smoke`.
- Migration scaffold: `npm run next:shell:smoke`.
- Next.js type safety: `npm --prefix apps/web-next run typecheck`.
- Next.js production sanity: `npm --prefix apps/web-next run build`.

## Follow-Up Phases

1. Move shared Route B contracts into a package once both routes need imports.
2. Add Next.js API route adapters for summary, transcribe, and pronunciation while preserving mock fallback.
3. Migrate the practice room UI after Route A confirms the browser WebRTC contract.
4. Retire the old static front end only after the Next.js path passes the same smoke/demo checks.
