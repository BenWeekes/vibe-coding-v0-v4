"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AgentState, Message, EnvStatus } from "./types";

export function useAgoraAgent() {
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  const clientRef = useRef<any>(null);
  const rtmClientRef = useRef<any>(null);
  const channelRef = useRef<string>("");
  const agentRtmUidRef = useRef<string>("");
  const audioTrackRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const volumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageCacheRef = useRef<Map<string, { part_idx: number; content: string }[]>>(new Map());

  // Check env on mount
  useEffect(() => {
    fetch("/api/check-env")
      .then((r) => r.json())
      .then(setEnvStatus)
      .catch(() => setEnvStatus({ ready: false, missing: ["Cannot reach server"] }));
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (isConnected) {
      setElapsed(0);
      elapsedTimerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
    return () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); };
  }, [isConnected]);

  // ---- Audio visualizer ----
  const startViz = useCallback((track: any) => {
    try {
      const mediaTrack = track.getMediaStreamTrack?.();
      if (!mediaTrack) return;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(new MediaStream([mediaTrack])).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        setAudioData(new Uint8Array(buf));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }, []);

  const stopViz = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAudioData(null);
  }, []);

  // ---- Transcript parsing (RTC stream-message) ----
  const handleTranscript = useCallback((msg: any) => {
    const role: "agent" | "user" = msg.object === "assistant.transcription" ? "agent" : "user";
    const id = `${role}-${msg.turn_id ?? Date.now()}`;
    const text: string = msg.text ?? "";
    if (!text) return;

    const isFinal = role === "user" ? msg.final === true : msg.turn_status === 1;

    setMessages((prev) => {
      const existing = prev.findIndex((m) => m.id === id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], text, final: isFinal };
        return updated;
      }
      return [...prev, { id, role, text, final: isFinal }];
    });
  }, []);

  // ---- Connect ----
  const handleConnect = useCallback(async (prompt: string, greeting: string) => {
    setError(null);
    setAgentState("joining");
    try {
      const res = await fetch("/api/start-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, greeting }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const { appId, channel, token, uid, agentId: aid, agentRtmUid } = await res.json();
      setAgentId(aid);

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.setLogLevel(4);

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user: any, mediaType: string) => {
        if (mediaType !== "audio") return;
        await client.subscribe(user, "audio");
        user.audioTrack?.play();
        if (volumeTimerRef.current) clearInterval(volumeTimerRef.current);
        volumeTimerRef.current = setInterval(() => {
          const vol = user.audioTrack?.getVolumeLevel?.() ?? 0;
          setAgentState(vol > 0.02 ? "talking" : "listening");
        }, 150);
      });
      client.on("user-unpublished", () => {
        if (volumeTimerRef.current) clearInterval(volumeTimerRef.current);
        setAgentState("listening");
      });
      client.on("user-left", () => {
        if (volumeTimerRef.current) clearInterval(volumeTimerRef.current);
        setAgentState("listening");
      });

      client.on("stream-message", (_uid: number, data: Uint8Array) => {
        try {
          const raw = new TextDecoder().decode(data);
          const parts = raw.split("|");

          if (parts.length === 4) {
            const [msgId, partIdxStr, partSumStr, partData] = parts;
            const partIdx = parseInt(partIdxStr, 10);
            const partSum = partSumStr === "???" ? -1 : parseInt(partSumStr, 10);
            const cache = messageCacheRef.current;

            if (!cache.has(msgId)) cache.set(msgId, []);
            const chunks = cache.get(msgId)!;
            chunks.push({ part_idx: partIdx, content: partData });
            chunks.sort((a, b) => a.part_idx - b.part_idx);

            if (partSum !== -1 && chunks.length === partSum) {
              const base64 = chunks.map((c) => c.content).join("");
              const decoded = atob(base64);
              const msg = JSON.parse(decoded);
              cache.delete(msgId);
              if (msg.object && msg.text !== undefined) {
                handleTranscript(msg);
              }
            }
          } else if (raw.startsWith("{")) {
            const msg = JSON.parse(raw);
            if (msg.object && msg.text !== undefined) {
              handleTranscript(msg);
            }
          }
        } catch {}
      });

      await client.join(appId, channel, token || null, Number(uid));

      const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "high_quality_stereo",
        AEC: true, ANS: true, AGC: true,
      });
      audioTrackRef.current = micTrack;
      await client.publish(micTrack);
      startViz(micTrack);

      channelRef.current = channel;
      agentRtmUidRef.current = agentRtmUid;
      try {
        const { default: AgoraRTM } = await import("agora-rtm");
        const rtm = new AgoraRTM.RTM(appId, String(uid));
        await rtm.login({ token: token || undefined });
        rtmClientRef.current = rtm;
      } catch {}

      setIsConnected(true);
      setAgentState("listening");
      setMessages([]);
    } catch (err: any) {
      setError(err.message || "Failed to connect");
      setAgentState("idle");
    }
  }, [startViz, handleTranscript]);

  // ---- Disconnect ----
  const handleDisconnect = useCallback(async () => {
    if (volumeTimerRef.current) clearInterval(volumeTimerRef.current);
    stopViz();

    if (rtmClientRef.current) {
      try { await rtmClientRef.current.logout(); } catch {}
      rtmClientRef.current = null;
    }
    channelRef.current = "";
    agentRtmUidRef.current = "";
    if (audioTrackRef.current) {
      audioTrackRef.current.close();
      audioTrackRef.current = null;
    }
    if (clientRef.current) {
      try { await clientRef.current.leave(); } catch {}
      clientRef.current = null;
    }
    if (agentId) {
      fetch("/api/hangup-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      }).catch(() => {});
    }

    setIsConnected(false);
    setAgentState("disconnected");
    setIsMuted(false);
    setAgentId(null);
    setMessages([]);
  }, [agentId, stopViz]);

  // ---- Mute ----
  const handleToggleMute = useCallback(async () => {
    const track = audioTrackRef.current;
    if (!track) return;
    const next = !isMuted;
    await track.setMuted(next);
    setIsMuted(next);
    if (next) stopViz();
    else startViz(track);
  }, [isMuted, startViz, stopViz]);

  // ---- Send text message via RTM ----
  const handleSend = useCallback(async (text: string) => {
    if (!text || !rtmClientRef.current || !agentRtmUidRef.current) return;
    try {
      const payload = JSON.stringify({ message: text, priority: "APPEND" });
      await rtmClientRef.current.publish(agentRtmUidRef.current, payload, {
        customType: "user.transcription",
        channelType: "USER",
      });
    } catch {}
  }, []);

  return {
    envStatus,
    agentState,
    isConnected,
    isMuted,
    messages,
    error,
    elapsed,
    audioData,
    handleConnect,
    handleDisconnect,
    handleToggleMute,
    handleSend,
  };
}
