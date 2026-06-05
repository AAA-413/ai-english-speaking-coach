# AI English Speaking Coach

AI English Speaking Coach is an AI-powered English speaking practice project. The initial product direction is a low-latency voice conversation coach for real-world scenarios such as interviews, travel, meetings, ordering food, and social conversation.

## Current Status

The first runnable shell is a dependency-free Node.js web app. It includes scenario selection, a practice room, a Realtime WebRTC session endpoint, mock post-session analysis, and mock scripted pronunciation scoring.

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

To try the real Realtime path, copy `.env.example` to `.env` or export the variables in your shell:

```bash
export OPENAI_API_KEY="your_api_key"
export OPENAI_REALTIME_MODEL="gpt-realtime-2"
export OPENAI_TEXT_MODEL="gpt-4.1-mini"
node server.mjs
```

The post-session summary uses the text model when `OPENAI_API_KEY` is configured. Set `USE_MOCK_ANALYSIS=true` to force mock reports during demos.
`POST /api/sessions/:id/transcribe` accepts `audioBase64` + `mimeType` and uses `OPENAI_TRANSCRIBE_MODEL` when a key is configured; otherwise it falls back to rough transcript/mock text.
The scripted pronunciation recorder now sends captured browser audio to the backend, while scoring still uses mock feedback until a pronunciation provider is connected.

In another terminal, run the API smoke test:

```bash
node scripts/smoke-test.mjs
```

## Docs

- [Design draft](docs/ai-english-speaking-coach-design.md)
- [Team alignment voice MVP](docs/team-alignment-voice-mvp.md)
- [GStack dual-track phase plan](docs/gstack-dual-track-phase-plan.md)
- [Route B AI handoff](docs/route-b-ai-handoff.md)

## Collaboration

- Use pull requests for changes to `main`.
- Keep product decisions and architecture notes in `docs/`.
- Prefer small, reviewable commits.
