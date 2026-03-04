"use client";

import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentState } from "./types";

export function AgentOrb({ state }: { state: AgentState }) {
  const active = state === "listening" || state === "talking" || state === "joining";
  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      {state === "talking" && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: "var(--agent-orb)", animationDuration: "0.9s" }}
          />
          <div
            className="absolute inset-6 rounded-full animate-ping opacity-15"
            style={{ background: "var(--agent-orb)", animationDuration: "1.2s" }}
          />
        </>
      )}
      {state === "listening" && (
        <div
          className="absolute inset-0 rounded-full animate-pulse opacity-10"
          style={{ background: "var(--agent-orb)" }}
        />
      )}
      {state === "joining" && (
        <div
          className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin opacity-40"
          style={{ borderColor: "var(--agent-orb)", borderTopColor: "transparent" }}
        />
      )}
      <div
        className={cn(
          "relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
          active ? "opacity-100 scale-100" : "opacity-30 scale-95",
          state === "talking" && "scale-110"
        )}
        style={{
          background: active
            ? "radial-gradient(circle at 35% 35%, var(--primary), var(--agent-orb))"
            : "var(--secondary)",
          boxShadow:
            state === "talking"
              ? "0 0 60px var(--agent-orb-glow), 0 0 100px var(--agent-orb-glow)"
              : state === "listening"
              ? "0 0 30px var(--agent-orb-glow)"
              : "none",
        }}
      >
        <Radio
          className={cn(
            "w-10 h-10 transition-colors duration-300",
            active ? "text-white" : "text-muted-foreground",
            state === "talking" && "animate-pulse"
          )}
        />
      </div>
      <span
        className="absolute -bottom-8 text-xs font-medium tracking-widest uppercase"
        style={{ color: active ? "var(--status-label-active)" : "var(--status-label-idle)" }}
      >
        {state === "idle" && "Ready"}
        {state === "joining" && "Connecting..."}
        {state === "listening" && "Listening"}
        {state === "talking" && "Speaking"}
        {state === "disconnected" && "Ended"}
      </span>
    </div>
  );
}
