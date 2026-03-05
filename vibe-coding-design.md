# Vibe Coding — Design Decisions

This document explains why the vibe-coding repos are structured the way they are, how they relate to the [agent-samples](https://github.com/AgoraIO-Conversational-AI/agent-samples) three-package architecture, and why each project makes different trade-offs for the same Agora Conversational AI platform.

For the agent-samples design rationale, see [`AI_SAMPLES_DESIGN.md`](https://github.com/AgoraIO-Conversational-AI/agent-samples/blob/main/assets/AI_SAMPLES_DESIGN.md) and [`AI_SAMPLES_UIKIT_TOOLKIT_DEV.md`](https://github.com/AgoraIO-Conversational-AI/agent-samples/blob/main/assets/AI_SAMPLES_UIKIT_TOOLKIT_DEV.md).

---

## Two Projects, Two Audiences

| | agent-samples | vibe-coding |
|---|---|---|
| **Who builds with it** | Developers (clone, install, code) | AI coding platforms (v0, Lovable) via a single prompt |
| **Who modifies it** | The developer, in an IDE | The AI platform, in response to natural language |
| **How it's installed** | `npm install --legacy-peer-deps` | Platform imports the GitHub URL and generates a project |
| **How it's customized** | Fork the repo, edit code | Tell the platform "make the mic button bigger" |

This single difference — **human developer vs AI platform as the builder** — drives every design decision below.

---

## The agent-samples Three-Package Model

Agent-samples uses a deliberate three-layer architecture (documented in [`AI_SAMPLES_DESIGN.md`](https://github.com/AgoraIO-Conversational-AI/agent-samples/blob/main/assets/AI_SAMPLES_DESIGN.md)):

```
agent-toolkit (@agora/conversational-ai)    — SDK layer
agent-ui-kit  (@agora/agent-ui-kit)         — Component layer
agent-samples                               — Application layer
```

This gives developers four adoption paths:
1. **Use everything** — clone agent-samples, working app in minutes
2. **SDK + own UI** — install the toolkit, build custom components
3. **Components + own logic** — install the ui-kit, wire up your own SDK calls
4. **Both packages** — combine SDK helpers with pre-built UI

The design philosophy is: **domain components from ui-kit, generic UI from shadcn/Tailwind**. Even agent-samples doesn't use ui-kit for buttons, inputs, or layout — it reserves ui-kit for voice AI domain components (AgentVisualizer, Conversation/Message, SettingsDialog/SessionPanel, AvatarVideoDisplay/VideoGrid) and handles everything else locally with Tailwind classes and lucide-react icons.

---

## Why Vibe-Coding Flattens Everything

Vibe-coding takes the agent-samples "shadcn for generic UI" principle to its logical conclusion: **when the AI platform is the developer, even domain-specific components should be generated locally**. Here's why.

### 1. Package hosting: GitHub refs don't work on AI platforms

Both packages are installed from GitHub, not npm:

```json
"@agora/conversational-ai": "github:AgoraIO-Conversational-AI/agent-toolkit#main",
"@agora/agent-ui-kit": "github:AgoraIO-Conversational-AI/agent-ui-kit#main"
```

v0 and Lovable cannot reliably install GitHub-hosted packages. Their build environments expect public npm registry packages. **If the toolkit and ui-kit were published to npm, this constraint would disappear** — but today they aren't, so vibe-coding can't use them.

### 2. AI platforms can't see into node_modules

When v0 or Lovable regenerates or debugs code, it reads the project's source files. It cannot read into `node_modules/@agora/conversational-ai/helper/rtc.ts` to understand what `RTCHelper.join()` does internally. The abstraction that helps human developers (hide complexity, expose clean API) hurts AI platforms (hide context, reduce ability to debug and modify).

With inline code, the platform sees every RTC event handler, every RTM message callback, and every transcript assembly step. When a user says "fix the transcript not updating," the AI can trace the entire flow.

### 3. AI platforms excel at generating UI — it's their core strength

Agent-ui-kit provides pre-built components like `AgentVisualizer`, `MicButton`, `Conversation`, and `Message`. For a developer, these save hours of work. But v0 and Lovable are purpose-built for generating React components from descriptions. Giving them a pre-built `MicButton` removes their ability to customize it — the user can't say "make the mic button pulse when listening" because the platform doesn't own that code.

This mirrors agent-samples' own design decision: even the developer-oriented samples use shadcn/Tailwind for generic UI instead of ui-kit primitives (Button, Card, Popover are exported by ui-kit but unused by the samples). Vibe-coding extends this to domain components too — the AI generates the agent orb, chat panel, and waveform visualizer locally because it needs to own them.

### 4. Platform-native component patterns

Each AI platform has conventions the AI understands deeply:
- **v0** generates shadcn/ui components in `components/ui/`, uses Next.js App Router patterns
- **Lovable** generates similar components in `src/components/ui/`, uses Vite + React patterns

Code that follows these conventions gets better AI modifications than code that imports from unfamiliar packages.

### 5. Fewer dependencies = fewer platform failures

Every npm dependency is a potential build failure on constrained platform sandboxes. By using only the two core Agora SDKs (`agora-rtc-sdk-ng` and `agora-rtm`) and no wrapper packages, we minimize the surface area for install failures.

---

## Why Inline Token Generation (v007)

Agent-samples uses the `agora-token` npm package (via the Python backend's equivalent). Vibe-coding generates v007 tokens inline. The primary reason is **Deno compatibility**.

### The Deno constraint

The Lovable variant uses **Supabase Edge Functions**, which run on **Deno** (not Node.js). The `agora-token` npm package cannot run in Deno:

| Blocker | Details |
|---------|---------|
| **100% CommonJS** | All files use `module.exports`/`require()`. No ESM entry point. [Issue #328](https://github.com/AgoraIO/Tools/issues/328) for ESM support was closed without action. |
| **Heavy `Buffer` usage** | ~30+ call sites: `Buffer.alloc()`, `Buffer.concat()`, `Buffer.from()`, `.writeUInt16LE()`, `.writeUInt32LE()`, `.toString('base64')`. Supabase Edge Functions run an older Deno without `Buffer` as a global. |
| **Synchronous Node.js crypto** | Uses `crypto.createHmac()` (sync). The Web-standard `crypto.subtle.sign()` is async — the entire `build()` API would need to become async. |
| **Synchronous zlib** | Uses `zlib.deflateSync()`. The Web-standard `CompressionStream` is also async. |

### What it would take to fix `agora-token` for Deno

The v007 builder (`AccessToken2.js`) has **zero npm dependencies** — the three deps (`crc-32`, `cuint`, `md5`) are only used by legacy v006 code. The required changes:

| Change | Effort |
|--------|--------|
| Convert CJS to ESM | Small |
| Replace ~30 `Buffer` calls with `Uint8Array` + `DataView` | Medium |
| Replace `crypto.createHmac` with `crypto.subtle.sign()` (async) | Small, but makes `build()` async |
| Replace `zlib.deflateSync` with `CompressionStream` (async) | Small, but also async |
| Drop the 3 unused npm deps from v007 path | Trivial |

The async change is the most impactful — it propagates through the entire API surface since all callers need to `await` token building.

### The inline implementation

The inline v007 builder is ~60 lines of Web-standard code:

| Node.js API | Web API Replacement |
|-------------|-------------------|
| `crypto.createHmac('sha256', ...)` | `crypto.subtle.importKey()` + `crypto.subtle.sign("HMAC", ...)` |
| `Buffer.alloc()`, `Buffer.concat()`, `Buffer.from()` | `Uint8Array` + manual `concat()` helper |
| `Buffer.writeUInt16LE()`, `Buffer.writeUInt32LE()` | `DataView.setUint16()`, `DataView.setUint32()` with little-endian flag |
| `zlib.deflateSync()` | `CompressionStream("deflate")` (Web Streams API) |
| `Buffer.toString('base64')` | `btoa()` with manual byte-to-char conversion |

This works natively in Deno, Supabase Edge Functions, Cloudflare Workers, or any Web-standard runtime — zero dependencies.

### Why v0 also uses inline tokens

The v0 variant (Next.js API routes on Node.js) could technically use the `agora-token` npm package. We use inline token generation anyway for:

- **Consistency** — same code pattern in both repos, easier to maintain
- **Zero token-related dependencies** — one less package for the AI platform to manage
- **Consistent AGENT.md** — no variant-specific dependency instructions

---

## The shadcn Connection

There's a direct line between agent-samples' design philosophy and vibe-coding's:

```
agent-samples:  "shadcn for generic UI, ui-kit for domain components"
                 ↓ extend the principle
vibe-coding:    "shadcn for everything — the AI platform is the developer"
```

Agent-samples already chose not to use ui-kit for buttons, inputs, layout, icons, or utilities — it uses shadcn conventions and Tailwind locally (documented in AI_SAMPLES_DESIGN.md: "the samples use a shadcn/v0-style CSS variable system for theming and Tailwind utilities for all generic layout and controls"). The ui-kit is reserved for voice AI domain logic that's hard to get right: transcript rendering with turn semantics, PTS-synced agent visualization, session debugging panels.

Vibe-coding drops the domain components too, because:
1. The packages aren't on npm (so they can't be installed)
2. The AI platform can't see into them (so it can't debug them)
3. The AI platform can generate them (so they're not saving effort)

If the toolkit and ui-kit were published to npm, reason #1 would go away. But #2 and #3 would remain — AI coding platforms fundamentally work better with source code they own than with abstractions they import.

---

## Platform-Specific Design Choices

### v0 (Vercel)

| Decision | Reason |
|----------|--------|
| Next.js 16 App Router | v0's native framework — the platform understands it deeply |
| API routes for backend (`app/api/`) | Built into Next.js, no separate backend needed |
| `styles/globals.css` decoy file | Prevents v0 from overwriting `app/globals.css` (v0 tends to create `styles/globals.css` and override the real one) |
| Embedded SVG in AGENT.md | v0 regenerates SVGs from scratch instead of reading them from the repo — embedding exact path data in the instructions forces correct output |
| Dynamic imports for Agora SDKs | Prevents SSR crashes — `agora-rtc-sdk-ng` and `agora-rtm` access browser APIs (`window`, `navigator`) |

### Lovable

| Decision | Reason |
|----------|--------|
| Vite + React 18 | Lovable's native framework |
| Supabase Edge Functions (Deno) | Lovable auto-links a Supabase project — Edge Functions are the natural backend |
| `test-server.mjs` for local dev | Supabase Edge Functions run Deno and can't easily run locally; the test server mimics the edge function endpoints in Node.js |
| SVG in `AgoraLogo.tsx` | Unlike v0, Lovable faithfully copies component code from the repo — no need to embed SVG in AGENT.md |

---

## Side-by-Side Comparison

| Aspect | agent-samples | vibe-coding |
|--------|--------------|-------------|
| **Target** | Developers | AI coding platforms (v0, Lovable) |
| **Architecture** | Three packages (SDK / UI / App) | Single self-contained repo |
| **SDK wrapper** | `@agora/conversational-ai` (RTCHelper, RTMHelper, SubRenderController) | Raw `agora-rtc-sdk-ng` + `agora-rtm` in a custom hook |
| **UI: generic** | shadcn/Tailwind locally (same as vibe-coding) | shadcn/Tailwind locally |
| **UI: domain** | `@agora/agent-ui-kit` (AgentVisualizer, Conversation, etc.) | Built from scratch by the AI platform |
| **Token generation** | Python backend uses Agora token lib | Inline v007 builder (Web APIs, Deno-compatible) |
| **Backend** | Python Flask (`simple-backend/`) | Next.js API routes (v0) / Supabase Edge Functions (Lovable) |
| **Runtime** | Node.js only | Node.js (v0) + Deno (Lovable) |
| **Installation** | `npm install --legacy-peer-deps` | Platform imports via URL prompt |
| **Package hosting** | GitHub refs (`github:AgoraIO-...#main`) | Only public npm packages |
| **Customization** | Fork and modify in IDE | Platform modifies via natural language |

---

## What agent-samples Gets From the Packages That We Reimplement

### From agent-toolkit

| Toolkit Feature | Vibe-Coding Equivalent |
|----------------|----------------------|
| `RTCHelper` singleton (join, publish, mute, volume monitoring) | Direct `AgoraRTC.createClient()` in custom hook |
| `RTMHelper` singleton (login, subscribe, send) | Direct `AgoraRTM.RTM()` in custom hook |
| `ConversationalAIAPI` orchestration (wires RTC + RTM + transcripts) | Hook manages both lifecycles directly |
| `SubRenderController` (turn dedup, word dedup, PTS sync, render modes) | Simplified transcript assembly in hook (pipe-delimited base64 protocol v2) |
| Dual transport (RTC stream messages + RTM) | Both transports handled inline |
| React hooks (`useLocalVideo`, `useRemoteVideo`) | Not needed (voice-only, no video) |

### From agent-ui-kit

| UI Kit Component | Vibe-Coding Equivalent |
|-----------------|----------------------|
| `AgentVisualizer` (Lottie-based state animation) | Custom animated orb (`AgentOrb.tsx`) with CSS animations |
| `Conversation` / `Message` / `Response` | Custom `ChatPanel.tsx` |
| `MicButton` with `SimpleVisualizer` | Custom mic button with `WaveformBars.tsx` |
| `SettingsDialog` / `SessionPanel` | Custom `SettingsPanel.tsx` |
| `AgoraLogo` | Custom `AgoraLogo.tsx` (Lovable) / `public/agora.svg` (v0) |
| `AudioVisualizer` / `LiveWaveform` | Custom waveform in hook + component |

Note: agent-samples itself doesn't use ui-kit's `Button`, `Card`, `Popover`, `MicButton`, `MicSelector`, `CameraSelector`, `MessageEngine`, or `cn()` — it handles these locally with shadcn/Tailwind. Vibe-coding extends this to the domain components too.

---

## What Would Change If Packages Were on npm

If `@agora/conversational-ai` and `@agora/agent-ui-kit` were published to the npm registry:

| Constraint | Status |
|-----------|--------|
| **Can't install on AI platforms** | **Removed** — npm packages work on v0 and Lovable |
| **AI can't see into node_modules** | **Remains** — platforms still can't read/modify package internals |
| **AI generates UI better from source** | **Remains** — platforms work better with code they own |
| **Deno token gen** | **Unrelated** — token gen is server-side, toolkit is client-side |

Publishing to npm would make it *possible* to use the toolkit on AI platforms, but the black-box and AI-modifiability arguments still favor inline code for this use case. The three-package model is designed for developers who understand APIs and read documentation; AI platforms work best with flat, visible source code they can trace end-to-end.

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
