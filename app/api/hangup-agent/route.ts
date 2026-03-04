import { NextRequest, NextResponse } from "next/server";
import { webcrypto } from "crypto";
import { deflate } from "zlib";

const subtle = globalThis.crypto?.subtle || webcrypto.subtle;

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
async function buildTokenForAuth(appId: string, appCertificate: string): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const expire = 86400;
  const salt = Math.floor(Math.random() * 99999999) + 1;
  let signing = await hmacSha256(packUint32(issueTs), new TextEncoder().encode(appCertificate));
  signing = await hmacSha256(packUint32(salt), signing);
  const rtcPrivileges: Record<number, number> = { 1: expire, 2: expire, 3: expire, 4: expire };
  const rtcPacked = concatBytes(packUint16(1), packMapUint32(rtcPrivileges), packString(""), packString(""));
  const rtmPrivileges: Record<number, number> = { 1: expire };
  const rtmPacked = concatBytes(packUint16(2), packMapUint32(rtmPrivileges), packString(""));
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
  const token = await buildTokenForAuth(appId, appCertificate);
  return `agora token=${token}`;
}

export async function POST(req: NextRequest) {
  const appId = process.env.APP_ID;
  const appCertificate = process.env.APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    return NextResponse.json(
      { error: "Missing APP_ID or APP_CERTIFICATE" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { agentId } = body;

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  const agoraRes = await fetch(
    `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${agentId}/leave`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await buildAuthHeader(appId, appCertificate),
      },
    }
  );

  const data = await agoraRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: agoraRes.status });
}
