"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, MicOff, Phone, PhoneOff, Settings, Loader2, Wifi, AlertCircle,
  Sun, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./useTheme";
import { useAgoraAgent } from "./useAgoraAgent";
import { AgentOrb } from "./AgentOrb";
import { WaveformBars } from "./WaveformBars";
import { ChatPanel } from "./ChatPanel";
import { SettingsPanel } from "./SettingsPanel";

export function VoiceAgent() {
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    envStatus, agentState, isConnected, isMuted, messages,
    error, elapsed, audioData,
    handleConnect, handleDisconnect, handleToggleMute, handleSend,
  } = useAgoraAgent();

  const [chatInput, setChatInput] = useState("");
  const [prompt, setPrompt] = useState(
    "You are a friendly, concise voice assistant. Keep responses under 20 words. Be warm and helpful."
  );
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const onConnect = useCallback(() => handleConnect(prompt, greeting), [handleConnect, prompt, greeting]);

  const onSend = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    handleSend(text);
  }, [chatInput, handleSend]);

  // ---- Render: loading ----
  if (envStatus === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  // ---- Render: missing env vars ----
  if (!envStatus.ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full bg-card border border-border rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
              <Wifi className="w-5 h-5 text-destructive" />
            </div>
            <h1 className="text-base font-semibold text-foreground">Configuration Required</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Add the following environment variables in the <strong className="text-foreground">Vars</strong> panel:
          </p>
          <ul className="space-y-2">
            {envStatus.missing.map((v) => (
              <li key={v} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                <code className="text-destructive font-mono text-xs">{v}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // ---- Render: main UI ----
  return (
    <div className="relative flex flex-col h-screen bg-background overflow-hidden font-sans">
      {showSettings && (
        <SettingsPanel
          prompt={prompt}
          greeting={greeting}
          onPromptChange={setPrompt}
          onGreetingChange={setGreeting}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agora.svg" alt="Agora" width={36} height={36} className="shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground leading-tight tracking-tight">
              Agora Convo AI Voice Agent
            </span>
            <span className="text-xs text-muted-foreground">
              {isConnected ? (
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                  <span className="font-mono">{fmt(elapsed)}</span>
                </span>
              ) : (
                "React with Agora Web SDK"
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            disabled={isConnected}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — Orb + controls */}
        <div className="flex flex-col items-center justify-between py-10 px-6 w-64 flex-shrink-0 border-r border-border">
          <div className="flex flex-col items-center gap-10">
            <AgentOrb state={agentState} />
            {isConnected && (
              <WaveformBars audioData={audioData} active={!isMuted} />
            )}
          </div>

          <div className="flex flex-col items-center gap-3 w-full">
            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 w-full">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {!isConnected ? (
              <button
                onClick={onConnect}
                disabled={agentState === "joining"}
                className="h-11 px-6 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-primary text-primary-foreground transition-all duration-300 hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {agentState === "joining" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                ) : (
                  <><Phone className="w-4 h-4" /> Start Call</>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  className={cn(
                    "w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200",
                    isMuted
                      ? "bg-muted text-destructive"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  onClick={handleDisconnect}
                  className="h-11 px-6 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-destructive text-white transition-all duration-300 hover:bg-destructive/90"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Chat */}
        <ChatPanel
          messages={messages}
          isConnected={isConnected}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSend={onSend}
          messagesEndRef={messagesEndRef}
        />
      </div>
    </div>
  );
}
