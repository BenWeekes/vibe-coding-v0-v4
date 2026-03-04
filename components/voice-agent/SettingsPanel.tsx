"use client";

export function SettingsPanel({
  prompt, greeting,
  onPromptChange, onGreetingChange, onClose,
}: {
  prompt: string; greeting: string;
  onPromptChange: (v: string) => void;
  onGreetingChange: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Agent Settings</h2>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Close
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">System Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            placeholder="You are a helpful voice assistant..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Greeting</label>
          <input
            value={greeting}
            onChange={(e) => onGreetingChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Hi there! How can I help you?"
          />
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Save
        </button>
      </div>
    </div>
  );
}
