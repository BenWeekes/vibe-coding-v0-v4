"use client";

import { Mic, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "./types";

function ChatBubble({ message }: { message: Message }) {
  const isAgent = message.role === "agent";
  return (
    <div className={cn("flex flex-col gap-1", isAgent ? "items-start" : "items-end")}>
      <span className="text-xs text-muted-foreground px-1">
        {isAgent ? "Agent" : "You"}
      </span>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isAgent ? "rounded-tl-sm" : "rounded-tr-sm",
          !message.final && "opacity-60"
        )}
        style={{
          backgroundColor: isAgent ? "var(--secondary)" : "var(--foreground)",
          color: isAgent ? "var(--secondary-foreground)" : "var(--background)",
        }}
      >
        {message.text}
        {!message.final && (
          <span className="inline-flex gap-0.5 ml-1.5 align-middle">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({
  messages,
  isConnected,
  chatInput,
  onChatInputChange,
  onSend,
  messagesEndRef,
}: {
  messages: Message[];
  isConnected: boolean;
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSend: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {messages.length === 0 && !isConnected && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <Mic className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Press <strong className="text-foreground">Start Call</strong> to start talking with the AI agent.
            </p>
          </div>
        )}
        {messages.length === 0 && isConnected && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-muted-foreground">Say something or type a message...</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isConnected && (
        <div
          className="flex-shrink-0 border-t px-4 py-3"
          style={{ borderColor: "var(--chat-border)" }}
        >
          <div className="flex items-center gap-2">
            <input
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring h-10"
              style={{
                backgroundColor: "var(--background)",
                borderColor: chatInput ? "var(--primary)" : "var(--border)",
              }}
            />
            <button
              onClick={onSend}
              disabled={!chatInput.trim()}
              aria-label="Send"
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:cursor-not-allowed",
                chatInput.trim()
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
