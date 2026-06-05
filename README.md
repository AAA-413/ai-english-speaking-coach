# AI English Speaking Coach

AI English Speaking Coach is an AI-powered English speaking practice project. The initial product direction is a low-latency voice conversation coach for real-world scenarios such as interviews, travel, meetings, ordering food, and social conversation.

## Current Status

The first runnable shell is a dependency-free Node.js web app. It includes scenario selection, a practice room, a Realtime WebRTC session endpoint, OpenAI/mock post-session analysis, and Azure/mock scripted pronunciation scoring.

Sprint status: the project is now in integration, QA, and demo polish. See [Demo runbook and status](docs/demo-runbook-and-status.md) for current phase, demo path, and remaining work.

## Run Locally

```bash
node server.mjs
```

Then open:

```text
http://localhost:3000
```

Without `OPENAI_API_KEY`, the app automatically uses mock mode so the full demo flow still works.
During a practice session, use **Export JSON** to download the current scenario, turns, summary, pronunciation text, and event log for Route B integration.

## Parallel Next.js Shell

This branch also includes a Next.js + TypeScript shell under `apps/web-next`. It is a parallel migration path and does not replace the current Node demo.

```bash
npm install --prefix apps/web-next
npm run next:dev
```

Then open:

```text
http://localhost:3001
```

Useful checks:

```bash
npm run next:shell:smoke
npm run next:typecheck
npm run next:build
```

To try the real Realtime path, copy `.env.example` to `.env` or export the variables in your shell:

```bash
export OPENAI_API_KEY="your_api_key"
export REALTIME_PROVIDER="openai"
export OPENAI_REALTIME_MODEL="gpt-realtime-2"
export OPENAI_TEXT_MODEL="gpt-4.1-mini"
node server.mjs
```

To prepare the Doubao O2.0 realtime path, use:

```bash
export REALTIME_PROVIDER="volc_doubao"
export VOLC_DOUBAO_MODEL="1.2.1.1"
export VOLC_RTC_APP_ID="your_volc_rtc_app_id"
export VOLC_DOUBAO_S2S_APP_ID="your_s2s_app_id"
export VOLC_DOUBAO_S2S_TOKEN="your_s2s_token"
node server.mjs
```

`1.2.1.1` is the Doubao O2.0 end-to-end realtime speech model. The backend now builds the StartVoiceChat configuration and redacts the S2S token from browser responses. The browser-side Volc RTC SDK connection is still the next integration step; until then, the app keeps the mock conversation fallback so the demo remains complete.

The post-session summary uses the text model when `OPENAI_API_KEY` is configured. Set `USE_MOCK_ANALYSIS=true` to force mock reports during demos.
`POST /api/sessions/:id/transcribe` accepts `audioBase64` + `mimeType` and uses `OPENAI_TRANSCRIBE_MODEL` when a key is configured; otherwise it falls back to rough transcript/mock text.
The scripted pronunciation recorder sends captured browser audio to the backend. If `AZURE_SPEECH_KEY` plus `AZURE_SPEECH_ENDPOINT` or `AZURE_SPEECH_REGION` are configured, the backend attempts Azure Pronunciation Assessment for WAV/OGG audio; browser WebM recordings still fall back to mock feedback unless converted.

In another terminal, run the API smoke test:

```bash
node scripts/smoke-test.mjs
```

## Docs

- [Design draft](docs/ai-english-speaking-coach-design.md)
- [Team alignment voice MVP](docs/team-alignment-voice-mvp.md)
- [GStack dual-track phase plan](docs/gstack-dual-track-phase-plan.md)
- [Route B AI handoff](docs/route-b-ai-handoff.md)
- [Demo runbook and status](docs/demo-runbook-and-status.md)
- [Volc Doubao realtime plan](docs/volc-doubao-realtime-plan.md)

## Collaboration

- Use pull requests for changes to `main`.
- Keep product decisions and architecture notes in `docs/`.
- Prefer small, reviewable commits.
