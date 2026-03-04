# Agora Conversational AI Voice Agent

A Next.js app that connects to an [Agora Conversational AI](https://www.agora.io/en/products/conversational-ai/) agent with real-time voice and text chat. Click **Start Call**, talk, and see live transcripts in the chat panel.

## Deploy with v0

Use this prompt to import the repo into v0:

```
Build this Agora Voice AI Agent: https://github.com/AgoraIO-Conversational-AI/vibe-coding-v0 — be sure to read AGENT.md in full.
```

When prompted for environment variables, provide:

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_ID` | Yes | Agora App ID ([Agora Console](https://console.agora.io)) |
| `APP_CERTIFICATE` | Yes | Agora App Certificate (32-char hex) — used with `APP_ID` to generate v007 tokens inline for RTC/RTM and API auth |
| `LLM_API_KEY` | Yes | LLM provider API key (e.g. OpenAI) |
| `TTS_VENDOR` | Yes | `rime`, `openai`, `elevenlabs`, or `cartesia` |
| `TTS_KEY` | Yes | TTS provider API key |
| `TTS_VOICE_ID` | Yes | Voice ID (e.g. `astra` for Rime, `alloy` for OpenAI) |
| `LLM_URL` | No | LLM endpoint (default: OpenAI) |
| `LLM_MODEL` | No | Model name (default: `gpt-4o-mini`) |

### Platform-Specific Tips

<!-- PLATFORM_TIPS_START -->

**v0 (Vercel):**
- Create a new **Project** first (not just a chat) before entering the prompt — this works more reliably
- Environment variables: click the project name dropdown in the title bar, then **Settings** > **Environment Variables**

  <img src="docs/v0-project-menu.png" width="360" alt="v0 project dropdown menu showing Settings option" />
  <img src="docs/v0-env-vars.png" width="480" alt="v0 Settings Environment Variables panel" />

- After adding environment variables, click the refresh icon in the preview toolbar and select **Restart Sandbox** for them to take effect

  <img src="docs/v0-restart-sandbox.png" width="300" alt="v0 preview toolbar showing Restart Sandbox option" />
- v0 may regenerate `styles/globals.css` — that's fine, the real theme is in `app/globals.css`
- The SVG logo at `public/agora.svg` must be copied as-is

<!-- PLATFORM_TIPS_END -->

## Run Locally

### Prerequisites

- Node.js 20+ (`nvm use 20`)
- Agora credentials, LLM API key, and TTS credentials (see table above)

### Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
```

Edit `.env.local` with your credentials, then:

```bash
npm run dev
```

Open http://localhost:3000

### How It Works

Next.js API routes handle everything server-side — no separate backend needed. The routes read credentials from `.env.local` and generate v007 Agora tokens with separate RTC and RTM UIDs.

| Route | Purpose |
|-------|---------|
| `GET /api/check-env` | Validates required env vars |
| `POST /api/start-agent` | Generates tokens, starts ConvoAI agent |
| `POST /api/hangup-agent` | Stops the agent |
| `GET /api/health` | Health check |

### Troubleshooting

- **`crypto` errors** — You need Node.js 20+. Run `nvm use 20`.
- **Port in use** — `lsof -ti:3000 | xargs kill`
- **No audio after connecting** — Check browser microphone permissions and DevTools console for RTC errors.

## Features

- **Real-time Voice** — Full-duplex audio via Agora RTC with echo cancellation, noise suppression, and auto gain control
- **Live Transcripts** — User and agent speech appears in the chat window as it happens
- **Text Chat** — Type a message and send it to the agent via Agora RTM
- **Agent Visualizer** — Animated orb (idle, joining, listening, speaking, disconnected)
- **Customizable** — Settings panel for system prompt and greeting
- **Self-contained** — Next.js API routes handle token generation, agent start, and hangup

## Architecture

```
Browser (Next.js 16 + React 19)
  │
  ├─ RTC audio ←→ Agora Conversational AI Agent
  ├─ RTC stream-message ← agent transcripts
  └─ RTM publish → text messages to agent

Next.js API Routes
  ├─ GET  /api/check-env    — validates required env vars
  ├─ POST /api/start-agent  — generates RTC+RTM tokens, calls Agora ConvoAI API
  ├─ POST /api/hangup-agent — stops the agent
  └─ GET  /api/health       — health check
```

## Tech Stack

- **Framework:** Next.js 16 with App Router and Turbopack
- **Language:** TypeScript 5
- **Runtime:** React 19
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **RTC SDK:** agora-rtc-sdk-ng v4.24+
- **RTM SDK:** agora-rtm v2.2+
- **Token gen:** v007 token builder (inline, server-side)

## License

MIT
