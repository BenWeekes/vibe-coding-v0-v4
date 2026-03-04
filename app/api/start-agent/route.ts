import { NextRequest, NextResponse } from "next/server";
import { webcrypto } from "crypto";
import { deflate } from "zlib";

const subtle = globalThis.crypto?.subtle || webcrypto.subtle;

const AGENT_UID = "100";
const USER_UID = "101";

function generateChannelName(length = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ---- v007 Token Builder (same as Lovable test-server) ----

function packUint16(v: number): Uint8Array {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, v, true);
  return buf;
}
function packUint32(v: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, v, true);
  return buf;
}
function packString(s: string): Uint8Array {
  const encoded = new TextEncoder().encode(s);
  return concatBytes(packUint16(encoded.length), encoded);
}
function packMapUint32(map: Record<number, number>): Uint8Array {
  const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
  const parts: Uint8Array[] = [packUint16(keys.length)];
  for (const k of keys) { parts.push(packUint16(k), packUint32(map[k])); }
  return concatBytes(...parts);
}
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}
async function hmacSha256(key: Uint8Array | string, message: Uint8Array): Promise<Uint8Array> {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await subtle.sign("HMAC", cryptoKey, message);
  return new Uint8Array(sig);
}
function deflateAsync(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    deflate(Buffer.from(data), (err, result) => {
      if (err) reject(err);
      else resolve(new Uint8Array(result));
    });
  });
}

async function buildToken(
  channelName: string,
  uid: string,
  appId: string,
  appCertificate: string,
  rtmUid?: string
): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const expire = 86400;
  const salt = Math.floor(Math.random() * 99999999) + 1;
  let signing = await hmacSha256(packUint32(issueTs), new TextEncoder().encode(appCertificate));
  signing = await hmacSha256(packUint32(salt), signing);
  const rtcPrivileges: Record<number, number> = { 1: expire, 2: expire, 3: expire, 4: expire };
  const rtcPacked = concatBytes(packUint16(1), packMapUint32(rtcPrivileges), packString(channelName), packString(uid));
  const rtmPrivileges: Record<number, number> = { 1: expire };
  const rtmPacked = concatBytes(packUint16(2), packMapUint32(rtmPrivileges), packString(rtmUid || uid));
  const signingInfo = concatBytes(packString(appId), packUint32(issueTs), packUint32(expire), packUint32(salt), packUint16(2), rtcPacked, rtmPacked);
  const signature = await hmacSha256(signing, signingInfo);
  const content = concatBytes(packUint16(signature.length), signature, signingInfo);
  const compressed = await deflateAsync(content);
  return "007" + Buffer.from(compressed).toString("base64");
}

async function buildAuthHeader(
  appId: string,
  appCertificate: string
): Promise<string> {
  const token = await buildToken("", "", appId, appCertificate);
  return `agora token=${token}`;
}

function buildTtsConfig(vendor: string, key: string, voiceId: string) {
  switch (vendor) {
    case "openai":
      return {
        vendor: "openai",
        params: {
          api_key: key,
          model: "tts-1",
          voice: voiceId,
          response_format: "pcm",
          speed: 1.0,
        },
      };
    case "elevenlabs":
      return {
        vendor: "elevenlabs",
        params: {
          key: key,
          model_id: "eleven_flash_v2_5",
          voice_id: voiceId,
          stability: 0.5,
          sample_rate: 24000,
        },
      };
    case "rime":
      return {
        vendor: "rime",
        params: {
          api_key: key,
          speaker: voiceId,
          modelId: "mistv2",
          lang: "eng",
          samplingRate: 16000,
          speedAlpha: 1.0,
        },
      };
    case "cartesia":
      return {
        vendor: "cartesia",
        params: {
          api_key: key,
          model_id: "sonic-3",
          sample_rate: 24000,
          voice: { mode: "id", id: voiceId },
        },
      };
    default:
      return {
        vendor: "rime",
        params: {
          api_key: key,
          speaker: voiceId,
          modelId: "mistv2",
          lang: "eng",
          samplingRate: 16000,
          speedAlpha: 1.0,
        },
      };
  }
}

export async function POST(req: NextRequest) {
  const appId = process.env.APP_ID;
  const appCertificate = process.env.APP_CERTIFICATE;
  const llmApiKey = process.env.LLM_API_KEY;
  const llmModel = process.env.LLM_MODEL || "gpt-4o-mini";
  const llmUrl =
    process.env.LLM_URL || "https://api.openai.com/v1/chat/completions";
  const ttsVendor = process.env.TTS_VENDOR;
  const ttsKey = process.env.TTS_KEY;
  const ttsVoiceId = process.env.TTS_VOICE_ID;

  const missing = [];
  if (!appId) missing.push("APP_ID");
  if (!appCertificate) missing.push("APP_CERTIFICATE");
  if (!llmApiKey) missing.push("LLM_API_KEY");
  if (!ttsVendor) missing.push("TTS_VENDOR");
  if (!ttsKey) missing.push("TTS_KEY");
  if (!ttsVoiceId) missing.push("TTS_VOICE_ID");

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing environment variables: ${missing.join(", ")}` },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const prompt =
    body.prompt ||
    "You are a friendly voice assistant. Keep responses concise, around 10 to 20 words. Be helpful and conversational.";
  const greeting = body.greeting || "Hi there! How can I help you today?";

  const channel = generateChannelName(10);
  const agentRtmUid = `${AGENT_UID}-${channel}`;
  const userToken = await buildToken(channel, USER_UID, appId!, appCertificate!);
  const agentToken = await buildToken(channel, AGENT_UID, appId!, appCertificate!, agentRtmUid);

  const ttsConfig = buildTtsConfig(ttsVendor, ttsKey!, ttsVoiceId);

  const agentPayload = {
    name: channel,
    properties: {
      channel,
      token: agentToken,
      agent_rtc_uid: AGENT_UID,
      agent_rtm_uid: agentRtmUid,
      remote_rtc_uids: ["*"],
      enable_string_uid: false,
      idle_timeout: 120,
      advanced_features: {
        enable_rtm: true,
      },
      llm: {
        url: llmUrl,
        api_key: llmApiKey,
        system_messages: [{ role: "system", content: prompt }],
        greeting_message: greeting,
        failure_message: "Sorry, something went wrong",
        max_history: 32,
        params: { model: llmModel },
        style: "openai",
      },
      asr: { vendor: "ares", language: "en-US" },
      tts: ttsConfig,
      parameters: {
        enable_dump: true,
        transcript: {
          enable: true,
          protocol_version: "v2",
          enable_words: false,
        },
      },
      turn_detection: {
        config: {
          end_of_speech: {
            mode: "semantic",
          },
        },
      },
    },
  };

  const authHeaderValue = await buildAuthHeader(appId!, appCertificate!);

  const agoraRes = await fetch(
    `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeaderValue,
      },
      body: JSON.stringify(agentPayload),
    }
  );

  const agoraResponseText = await agoraRes.text();

  if (!agoraRes.ok) {
    return NextResponse.json({ error: agoraResponseText }, { status: 502 });
  }

  const agoraData = JSON.parse(agoraResponseText);

  return NextResponse.json({
    appId,
    channel,
    token: userToken,
    uid: USER_UID,
    agentUid: AGENT_UID,
    agentRtmUid,
    agentId: agoraData?.agent_id || agoraData?.id || null,
    success: true,
  });
}
