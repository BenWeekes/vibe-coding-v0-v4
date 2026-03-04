# Agent Instructions

This file is for AI coding assistants. Read it in full before making changes.

## Project Overview

A Next.js 16 app (App Router, Turbopack, React 19, Tailwind CSS 4, shadcn/ui) that connects to an Agora Conversational AI voice agent. The app handles real-time audio via Agora RTC, text messaging via Agora RTM, and live transcripts via RTC stream-message.

**This code has been tested locally and is built with the v0 (Vercel) platform in mind.** All files are complete and working — import them as-is and wire up environment variables. Do not rewrite or restructure existing components.

## Critical Rules

- **Do NOT modify `app/globals.css`** — it contains the custom Agora brand theme (dark + light mode with cyan/teal primary colors, agent orb CSS vars, scrollbar styles). The `styles/globals.css` is a scaffold copy and can be ignored.
- **Do NOT modify files in `components/ui/`** — these are stock shadcn/ui components.
- **Do NOT inline Agora SDK imports at file top level** — `agora-rtc-sdk-ng` and `agora-rtm` require browser APIs and crash SSR. They must be dynamically imported inside async functions.
- **Do NOT add transcripts to the chat UI on RTM send** — the agent echoes them back via the RTC stream-message listener, so they appear automatically.

## Assets

- **`public/agora.svg`** — The Agora logo used in the header. **Write this exact SVG to `public/agora.svg`** — do not generate, approximate, or substitute:

```svg
<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M24.9924 36.0241C22.81 36.0241 20.6766 35.3775 18.862 34.1662C17.0474 32.9548 15.6331 31.2331 14.798 29.2187C13.9628 27.2043 13.7443 24.9878 14.17 22.8493C14.5958 20.7109 15.6467 18.7466 17.1899 17.2048C18.7331 15.6631 20.6992 14.6131 22.8397 14.1878C24.9802 13.7624 27.1988 13.9807 29.2151 14.8151C31.2314 15.6495 32.9547 17.0625 34.1672 18.8754C35.3797 20.6883 36.0268 22.8196 36.0268 25C36.0239 27.9229 34.8604 30.7251 32.7917 32.7919C30.7229 34.8587 27.918 36.0211 24.9924 36.0241ZM37.8416 8.93956L37.6736 9.1634L37.5056 9.38724L37.2815 9.21936L37.0687 9.05148C34.5373 7.14076 31.5875 5.85883 28.4626 5.31148C25.3376 4.76414 22.1272 4.96708 19.0963 5.90355C16.0653 6.84003 13.3007 8.48318 11.0306 10.6974C8.76056 12.9117 7.05008 15.6335 6.04036 18.6383C5.03063 21.6431 4.75062 24.8447 5.22343 27.9789C5.69624 31.1131 6.90831 34.0901 8.75962 36.6641C10.6109 39.2381 13.0484 41.3354 15.8708 42.7828C18.6933 44.2303 21.8198 44.9864 24.9924 44.9888C29.356 45.0014 33.6015 43.5732 37.0687 40.9261L37.2815 40.7694L37.5056 40.5904L37.6736 40.8254L37.8416 41.0492C38.5966 42.0901 39.5544 42.9677 40.6575 43.6293C41.7606 44.2909 42.9862 44.7229 44.2606 44.8993L45 45V5L44.2606 5.10073C42.9873 5.27635 41.7624 5.70686 40.6595 6.36647C39.5565 7.02608 38.5981 7.90124 37.8416 8.93956Z" fill="#00C2FF"/>
</svg>
```

## Styling Rules

- All primary action buttons (mic toggle when unmuted, chat send button) use `bg-primary text-primary-foreground` — they must match visually
- Destructive actions (hangup button) use `bg-destructive text-destructive-foreground`
- Muted/disabled state (mic when muted) uses `bg-muted text-muted-foreground`
- The theme is defined in `app/globals.css` via CSS custom properties — do not hardcode colors, use the Tailwind theme tokens (`primary`, `muted`, `destructive`, etc.)

## File Structure

```
app/
  globals.css          — Custom Agora theme (DO NOT MODIFY)
  layout.tsx           — Root layout, imports globals.css
  page.tsx             — Dynamic import of VoiceAgent (ssr: false)
  api/
    check-env/route.ts — Validates required env vars
    start-agent/route.ts — Generates tokens, starts ConvoAI agent
    hangup-agent/route.ts — Stops the agent
    health/route.ts    — Health check

components/voice-agent/
  types.ts             — Shared types (AgentState, Message, EnvStatus)
  useTheme.ts          — Dark/light theme toggle hook
  useAgoraAgent.ts     — All Agora SDK logic, state, refs (the core hook)
  AgentOrb.tsx         — Animated orb with state indicators
  WaveformBars.tsx     — Audio frequency visualizer
  ChatPanel.tsx        — Chat bubbles + text input
  SettingsPanel.tsx    — System prompt + greeting modal
  VoiceAgent.tsx       — Shell component that composes everything

components/ui/        — Stock shadcn/ui (do not modify)
public/agora.svg      — Agora logo
styles/globals.css    — Scaffold copy (safe to overwrite)
```

## Environment Variables

All server-side only — read via `process.env` in API routes. Do NOT use `NEXT_PUBLIC_` prefix.

Required:
- `APP_ID` — Agora App ID
- `APP_CERTIFICATE` — Agora App Certificate (32-char hex). Used with APP_ID to generate v007 tokens inline for both RTC/RTM access and Agora Conversational AI API auth — no separate Customer Key/Secret or npm token package needed
- `LLM_API_KEY` — LLM provider API key (e.g. OpenAI)
- `TTS_VENDOR` — `rime`, `openai`, `elevenlabs`, or `cartesia`
- `TTS_KEY` — TTS provider API key
- `TTS_VOICE_ID` — Voice ID (e.g. `astra` for Rime, `alloy` for OpenAI)

Optional:
- `LLM_URL` — Default: `https://api.openai.com/v1/chat/completions`
- `LLM_MODEL` — Default: `gpt-4o-mini`

## Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# fill in .env.local
npm run dev
```

## API Route: `GET /api/check-env`

Validates required secrets (`APP_ID`, `APP_CERTIFICATE`, `LLM_API_KEY`, `TTS_VENDOR`, `TTS_KEY`, `TTS_VOICE_ID`) are set. Returns JSON:

```json
{ "configured": { "APP_ID": true, ... }, "ready": true, "missing": [] }
```

## API Route: `POST /api/start-agent`

Accepts optional POST body `{ prompt, greeting }`. Defaults: prompt = "You are a friendly voice assistant. Keep responses concise, around 10 to 20 words." greeting = "Hi there! How can I help you today?"

**Token generation** — v007 token builder that creates combined RTC+RTM tokens with separate UIDs. The RTC service uses the channel uid (e.g. `"100"`) while the RTM service uses a distinct RTM uid (e.g. `"100-{channel}"`).

UIDs are strings: agent = `"100"`, user = `"101"`. Channel is random 10-char alphanumeric. Agent RTM UID = `"100-{channel}"`.

**Agent payload** — POST to `https://api.agora.io/api/conversational-ai-agent/v2/projects/{appId}/join`:

```json
{
  "name": "{channel}",
  "properties": {
    "channel": "{channel}",
    "token": "{agentToken}",
    "agent_rtc_uid": "100",
    "agent_rtm_uid": "100-{channel}",
    "remote_rtc_uids": ["*"],
    "enable_string_uid": false,
    "idle_timeout": 120,
    "advanced_features": {
      "enable_rtm": true
    },
    "llm": {
      "url": "{LLM_URL or https://api.openai.com/v1/chat/completions}",
      "api_key": "{LLM_API_KEY}",
      "system_messages": [{ "role": "system", "content": "{prompt}" }],
      "greeting_message": "{greeting}",
      "failure_message": "Sorry, something went wrong",
      "max_history": 32,
      "params": { "model": "{LLM_MODEL or gpt-4o-mini}" },
      "style": "openai"
    },
    "asr": { "vendor": "ares", "language": "en-US" },
    "tts": "{ttsConfig}",
    "parameters": {
      "enable_dump": true,
      "transcript": {
        "enable": true,
        "protocol_version": "v2",
        "enable_words": false
      }
    },
    "turn_detection": {
      "config": {
        "end_of_speech": {
          "mode": "semantic"
        }
      }
    }
  }
}
```

**TTS config builder** — supports multiple vendors:

- **rime** (default): `{ vendor: "rime", params: { api_key, speaker: voiceId, modelId: "mistv2", lang: "eng", samplingRate: 16000, speedAlpha: 1.0 } }`
- **openai**: `{ vendor: "openai", params: { api_key, model: "tts-1", voice: voiceId, response_format: "pcm", speed: 1.0 } }`
- **elevenlabs**: `{ vendor: "elevenlabs", params: { key, model_id: "eleven_flash_v2_5", voice_id: voiceId, stability: 0.5, sample_rate: 24000 } }`
- **cartesia**: `{ vendor: "cartesia", params: { api_key, model_id: "sonic-3", sample_rate: 24000, voice: { mode: "id", id: voiceId } } }`

Returns: `{ appId, channel, token, uid, agentUid, agentRtmUid, agentId, success }`

## API Route: `POST /api/hangup-agent`

POST with `{ agentId }`. Calls `POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{appId}/agents/{agentId}/leave` with token-based auth header.

## Frontend: Browser-Only SDK Imports

Both `agora-rtc-sdk-ng` and `agora-rtm` require browser APIs and will crash SSR. They must be dynamically imported inside async functions, never at the top of the file. The page component must use `next/dynamic` with `ssr: false`:

```typescript
"use client";
import dynamic from "next/dynamic";
const VoiceAgent = dynamic(() => import("@/components/voice-agent/VoiceAgent").then(m => ({ default: m.VoiceAgent })), { ssr: false });
export default function Page() { return <VoiceAgent />; }
```

## Frontend: RTC Voice + Transcript Listener

**Register ALL event listeners BEFORE `client.join()`.** The `stream-message` listener is critical — it receives ALL transcripts (both user speech and agent responses).

```typescript
const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
AgoraRTC.setLogLevel(4); // error only
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

// Subscribe to agent audio
client.on("user-published", async (user, mediaType) => {
  if (mediaType !== "audio") return;
  await client.subscribe(user, "audio");
  user.audioTrack?.play();
  // Poll user.audioTrack.getVolumeLevel() to detect agent speaking
});

// CRITICAL: Transcript listener — agent sends ALL transcripts via RTC data stream
// Protocol v2 sends data as pipe-delimited base64 chunks: messageId|partIdx|partSum|base64data
// You MUST decode this format — raw JSON.parse() will NOT work.
const messageCache = new Map<string, { part_idx: number; content: string }[]>();

client.on("stream-message", (_uid: number, data: Uint8Array) => {
  try {
    const raw = new TextDecoder().decode(data);
    const parts = raw.split("|");

    let msg: any;
    if (parts.length === 4) {
      // v2 chunked format: messageId|partIdx|partSum|base64data
      const [msgId, partIdxStr, partSumStr, partData] = parts;
      const partIdx = parseInt(partIdxStr, 10);
      const partSum = partSumStr === "???" ? -1 : parseInt(partSumStr, 10);

      if (!messageCache.has(msgId)) messageCache.set(msgId, []);
      const chunks = messageCache.get(msgId)!;
      chunks.push({ part_idx: partIdx, content: partData });
      chunks.sort((a, b) => a.part_idx - b.part_idx);

      if (partSum === -1 || chunks.length < partSum) return; // wait for more chunks
      const base64 = chunks.map((c) => c.content).join("");
      msg = JSON.parse(atob(base64));
      messageCache.delete(msgId);
    } else if (raw.startsWith("{")) {
      msg = JSON.parse(raw); // fallback: raw JSON
    } else {
      return;
    }

    // msg.object = "user.transcription" or "assistant.transcription"
    // msg.text = transcript text
    // msg.turn_id = groups messages into turns
    // For user: msg.final = true means end of utterance
    // For assistant: msg.turn_status === 1 means end of turn
    if (msg.object && msg.text !== undefined) {
      const role = msg.object === "assistant.transcription" ? "agent" : "user";
      const isFinal =
        role === "user" ? msg.final === true : msg.turn_status === 1;
      updateMessages(role, msg.turn_id, msg.text, isFinal);
    }
  } catch {
    /* ignore malformed data */
  }
});

await client.join(appId, channel, token || null, Number(uid));
const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
  encoderConfig: "high_quality_stereo",
  AEC: true,
  ANS: true,
  AGC: true,
});
await client.publish(micTrack);
```

**IMPORTANT: Transcripts arrive via RTC `stream-message`, NOT via RTM.** Protocol v2 encodes transcripts as base64 inside a pipe-delimited string (`messageId|partIdx|partSum|base64data`) — you MUST split on `|`, accumulate chunks by messageId, `atob()` the joined base64, then `JSON.parse()`. Raw `JSON.parse()` on the stream data will NOT work. Both user speech transcripts and agent response transcripts come through this single listener. The agent greeting also arrives here — do not hardcode it. Display transcripts as chat bubbles grouped by `turn_id`. Update in-place for partial transcripts, mark final when complete.

## Frontend: RTM Text Messaging (send only)

RTM is used **ONLY for sending text messages** from the user to the agent. Do NOT use `createStreamChannel`, `joinTopic`, `publishTopicMessage`, or `sendMessage`.

```typescript
const { default: AgoraRTM } = await import("agora-rtm");
const rtm = new AgoraRTM.RTM(appId, String(uid), {
  token: token || undefined,
} as any);
await rtm.login(); // no arguments — token goes in constructor above

// Send text message — target is agent's RTM UID, NOT the channel name
const payload = JSON.stringify({ message: text, priority: "APPEND" });
await rtm.publish(agentRtmUid, payload, {
  customType: "user.transcription",
  channelType: "USER",
});

// Disconnect
await rtm.logout();
```

**IMPORTANT RTM rules:**

- Publish target is `agentRtmUid` (e.g. `"100-{channel}"`), NOT the channel name
- Message must be JSON: `{ "message": "text", "priority": "APPEND" }`
- Options must include `customType: "user.transcription"` and `channelType: "USER"`
- Do NOT add the message to the chat UI locally — the agent echoes it back as a `user.transcription` via the RTC stream-message transcript listener, so it appears automatically
- Never `console.log()` the RTM client object — it causes `RangeError: Invalid string length` from circular references

## Frontend: UI Layout

**Pre-connection (idle state):** Left panel with centered orb, Connect button, error display. Right panel with placeholder text. Settings button in header opens modal for system prompt and greeting (disabled while connected).

**Connected:** Left panel has animated orb (pulsing when listening, scaling + glowing when speaking, spinning border when joining), waveform bars from Web Audio API AnalyserNode, mute/unmute + hangup buttons. Right panel has scrolling chat with agent/user bubbles (in-progress messages show bouncing dots and reduced opacity), text input with send button (only visible when connected). Header shows app title, elapsed timer, "Live" indicator, settings gear.

**Agent orb states:** idle (dim, scaled down), joining (spinning border), listening (gentle pulse), talking (ping rings + glow + scale up), disconnected (dim).
