# Vibe Coding — Design Decisions

This document explains why the vibe-coding repos are structured the way they are, and how they differ from the developer-oriented [agent-samples](https://github.com/AgoraIO-Conversational-AI/agent-samples) project.

---

## Target Audience

The vibe-coding repos are designed for **AI coding platforms** (v0, Lovable) where a single prompt imports the repo and the platform generates/modifies all code. The agent-samples repo is designed for **developers** who install dependencies, run builds, and write code themselves.

This single difference drives every design decision below.

---

## Why No `@agora/conversational-ai` (Agent Toolkit)

The [agent-samples](https://github.com/AgoraIO-Conversational-AI/agent-samples) react-voice-client and react-video-client-avatar both depend on `@agora/conversational-ai` (the "agent toolkit"), which provides:

- **`ConversationalAIAPI`** — Orchestrates RTC + RTM, routes stream messages to the SubRenderController
- **`RTCHelper`** — Singleton wrapper around the Agora RTC SDK (join, leave, publish, mute, volume, etc.)
- **`RTMHelper`** — Singleton wrapper around the Agora RTM SDK (login, subscribe, send messages)
- **`SubRenderController`** — Queue-based transcript processing with turn deduplication, word deduplication, PTS sync, and multiple render modes (text/word/chunk/auto)

The vibe-coding repos implement all of this directly in a custom `useAgoraVoiceClient` hook using the raw `agora-rtc-sdk-ng` and `agora-rtm` SDKs. The reasons:

### 1. Private GitHub dependency

The agent toolkit is installed from a GitHub URL, not npm:

```json
"@agora/conversational-ai": "github:AgoraIO-Conversational-AI/agent-toolkit#main"
```

AI coding platforms (v0, Lovable) cannot reliably install private or GitHub-hosted packages. They work best with public npm packages or self-contained code they can read directly.

### 2. AI platforms need to see and modify the code

When v0 or Lovable regenerates code, they need full visibility into what the code does. An abstraction layer like `RTCHelper` or `ConversationalAIAPI` is a black box — the platform can't read into `node_modules` to understand the SDK's behavior, debug issues, or make changes.

With inline code, the platform can see every RTC event handler, every RTM message, and every transcript assembly step. It can modify any of it when the user requests changes.

### 3. Fewer moving parts = fewer failures

Every npm dependency is a potential point of failure on these platforms. The v0 sandbox and Lovable build environments have constraints around package installation. By using only the two core Agora SDKs (`agora-rtc-sdk-ng` and `agora-rtm`) and no wrapper packages, we minimize the surface area for install failures.

### 4. Self-contained by design

The AGENT.md files (which the AI platform reads as instructions) emphasize that the project is self-contained. The platform should be able to build and run the project from the repo alone, without understanding an external package ecosystem.

---

## Why No `@agora/agent-ui-kit`

The agent-samples projects also use `@agora/agent-ui-kit`, which provides pre-built React components:

- **Voice:** `MicButton`, `AgentVisualizer`, `AudioVisualizer`, `SimpleVisualizer`, `LiveWaveform`
- **Chat:** `Conversation`, `Message`, `Response`, `ConvoTextStream`
- **Video:** `AvatarVideoDisplay`, `LocalVideoPreview`, `Avatar`, `CameraSelector`
- **Layout:** `VideoGrid`, `MobileTabs`
- **Branding:** `AgoraLogo`
- **UI Primitives:** `Button`, `IconButton`, `Card`, `Chip`, `ValuePicker`

The vibe-coding repos build equivalent components from scratch using shadcn/ui primitives. The reasons:

### 1. Same GitHub-hosted dependency problem

```json
"@agora/agent-ui-kit": "github:AgoraIO-Conversational-AI/agent-ui-kit#main"
```

Not installable by AI coding platforms.

### 2. AI platforms excel at generating UI

This is what v0 and Lovable are built for. Giving them pre-built components removes their ability to customize the UI, which is the primary value proposition of using these platforms. Users want to say "make the mic button bigger" or "change the chat layout" — the platform needs to own that code.

### 3. Platform-native component patterns

Each platform has its own conventions:
- **v0** generates shadcn/ui components in a `components/ui/` directory
- **Lovable** does the same via its Vite + React template

Using the platform's native component patterns means the AI understands the code structure and can modify it confidently.

---

## Why Inline Token Generation (v007)

Both repos generate Agora v007 tokens inline in the server-side code rather than using the `agora-token` npm package. This is the most important architectural decision.

### The primary reason: Deno compatibility

The **Lovable variant** uses Supabase Edge Functions, which run on **Deno** (not Node.js). The `agora-token` npm package cannot run in Deno because:

| Blocker | Details |
|---------|---------|
| **100% CommonJS** | All files use `module.exports`/`require()`. No ESM entry point. There's an [open issue](https://github.com/AgoraIO/Tools/issues/328) for ESM support that was closed without action. |
| **Heavy `Buffer` usage** | ~30+ call sites: `Buffer.alloc()`, `Buffer.concat()`, `Buffer.from()`, `.writeUInt16LE()`, `.writeUInt32LE()`, `.toString('base64')`, etc. Supabase Edge Functions run an older Deno version without `Buffer` as a global. |
| **Synchronous Node.js crypto** | Uses `crypto.createHmac()` (sync). The Web-standard equivalent `crypto.subtle.sign()` is async, so the `build()` method would need to become `async`. |
| **Synchronous zlib** | Uses `zlib.deflateSync()`. The Web-standard equivalent `CompressionStream` is also async. |

### What it would take to fix `agora-token` for Deno

The v007 token builder (`AccessToken2.js`) actually has **zero npm dependencies** — the three deps (`crc-32`, `cuint`, `md5`) are only used by legacy v006 code. The required changes:

| Change | Effort |
|--------|--------|
| Convert CJS to ESM (`require`/`module.exports` → `import`/`export`) | Small |
| Replace ~30 `Buffer` calls with `Uint8Array` + `DataView` | Medium |
| Replace `crypto.createHmac` with `crypto.subtle.sign()` (async) | Small, but makes `build()` async |
| Replace `zlib.deflateSync` with `CompressionStream` (async) | Small, but also async |
| Drop the 3 unused npm deps from v007 path | Trivial |

The async change is the most impactful — it propagates through the entire API surface since all callers need to `await` token building.

### The inline implementation

The inline v007 builder is ~60 lines of Web-standard code using:

| Node.js API | Web API Replacement |
|-------------|-------------------|
| `crypto.createHmac('sha256', ...)` | `crypto.subtle.importKey()` + `crypto.subtle.sign("HMAC", ...)` |
| `Buffer.alloc()`, `Buffer.concat()`, `Buffer.from()` | `Uint8Array` + manual `concat()` helper |
| `Buffer.writeUInt16LE()`, `Buffer.writeUInt32LE()` | `DataView.setUint16()`, `DataView.setUint32()` with little-endian flag |
| `zlib.deflateSync()` | `CompressionStream("deflate")` (Web Streams API) |
| `Buffer.toString('base64')` | `btoa()` with manual byte-to-char conversion |

This works natively in Deno, Supabase Edge Functions, Cloudflare Workers, or any Web-standard runtime — with zero dependencies.

### Consistency across variants

The **v0 variant** (Next.js API routes) could technically use the `agora-token` npm package since it runs on Node.js. However, keeping inline token generation in both variants means:

- Same code pattern in both repos, easier to maintain
- v0 also benefits from zero token-related dependencies
- AGENT.md instructions are consistent — no variant-specific dependency differences

---

## Platform-Specific Design Choices

### v0 (Vercel)

| Decision | Reason |
|----------|--------|
| Next.js 16 App Router | v0's native framework — the platform understands it deeply |
| API routes for backend (`app/api/`) | Built into Next.js, no separate backend needed |
| `styles/globals.css` decoy file | Prevents v0 from overwriting `app/globals.css` (v0 has a tendency to create a `styles/globals.css` and override the real one) |
| Embedded SVG in AGENT.md | v0 regenerates SVGs from scratch instead of reading them from the repo — embedding the exact path data in the instructions forces correct output |
| Dynamic imports for Agora SDKs | Prevents SSR crashes — `agora-rtc-sdk-ng` and `agora-rtm` access browser APIs (`window`, `navigator`) and crash during server-side rendering |

### Lovable

| Decision | Reason |
|----------|--------|
| Vite + React 18 | Lovable's native framework |
| Supabase Edge Functions (Deno) | Lovable auto-links a Supabase project — Edge Functions are the natural backend |
| `test-server.mjs` for local dev | Supabase Edge Functions run Deno and can't easily run locally. The test server mimics the edge function endpoints in Node.js for local development |
| SVG in `AgoraLogo.tsx` | Unlike v0, Lovable faithfully copies component code from the repo — no need to embed SVG in AGENT.md |

---

## Comparison: agent-samples vs vibe-coding

| Aspect | agent-samples | vibe-coding |
|--------|--------------|-------------|
| **Target** | Developers | AI coding platforms |
| **SDK wrapper** | `@agora/conversational-ai` | Raw `agora-rtc-sdk-ng` + `agora-rtm` |
| **UI components** | `@agora/agent-ui-kit` | shadcn/ui primitives, hand-built |
| **Token generation** | `agora-token` npm package | Inline v007 builder (Web APIs) |
| **Backend** | Python Flask (`simple-backend/`) | Next.js API routes (v0) / Supabase Edge Functions (Lovable) |
| **Installation** | `pnpm install` (workspace) | Platform imports via URL prompt |
| **Customization** | Fork and modify | Platform modifies via chat |
| **Package hosting** | GitHub refs (`github:AgoraIO-...#main`) | Only public npm packages |
| **Runtime** | Node.js only | Node.js (v0) + Deno (Lovable) |

---

## What agent-samples Gets From the Toolkit That We Reimplement

| Toolkit Feature | Vibe-Coding Equivalent |
|----------------|----------------------|
| `RTCHelper` singleton | Direct `AgoraRTC.createClient()` in hook |
| `RTMHelper` singleton | Direct `AgoraRTM.RTM()` in hook |
| `ConversationalAIAPI` orchestration | Hook manages RTC + RTM lifecycle directly |
| `SubRenderController` (turn dedup, word dedup, PTS sync) | Simplified transcript assembly in hook (pipe-delimited base64 protocol v2) |
| `AgentVisualizer` component | Custom animated orb component (`AgentOrb.tsx`) |
| `MicButton` with audio visualization | Custom mic button with `WaveformBars.tsx` |
| `Conversation` / `Message` / `Response` | Custom `ChatPanel.tsx` |
| `AgoraLogo` component | Custom `AgoraLogo.tsx` (Lovable) / `public/agora.svg` (v0) |

The trade-off is more code to maintain, but full platform compatibility and AI-modifiability.

---

## ConvoAI Engine Payload

Both repos send the same payload format to the Agora Conversational AI API:

```json
{
  "name": "agora-agent",
  "properties": {
    "channel": "<channel>",
    "token": "<v007-token>",
    "agent_rtc_uid": "100",
    "remote_rtc_uids": ["101"],
    "enable_rtm": true,
    "llm": { "url": "...", "api_key": "...", "model": "...", "system_messages": [...], "greeting": { "text": "..." } },
    "tts": { "vendor": "...", "params": { "key": "...", "voice_id": "..." } },
    "advanced_features": { "enable_rtm": true },
    "parameters": {
      "enable_dump": true,
      "transcript": { "enable": true, "protocol_version": "v2", "enable_words": false }
    },
    "turn_detection": {
      "config": { "end_of_speech": { "mode": "semantic" } }
    }
  }
}
```

Key payload choices:
- **`protocol_version: "v2"`** — Pipe-delimited base64 chunks (`messageId|partIdx|partSum|base64data`) for transcript delivery via RTC stream messages
- **`turn_detection.config.end_of_speech.mode: "semantic"`** — Semantic end-of-speech detection (replaces the older `vad` + `enable_aivad`/`enable_bhvs`/`enable_sal` configuration)
- **`enable_dump: true`** — Enables server-side diagnostic dumps
- **`enable_rtm: true`** — Enables RTM text messaging between user and agent
