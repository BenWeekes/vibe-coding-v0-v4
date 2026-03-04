"use client";

const BAR_COUNT = 24;

export function WaveformBars({ audioData, active }: { audioData: Uint8Array | null; active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-8 w-32">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const val = audioData ? (audioData[Math.floor((i / BAR_COUNT) * audioData.length)] ?? 0) / 255 : 0;
        const height = active && audioData ? Math.max(3, val * 28) : 3;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: 3,
              height,
              background: `var(--primary)`,
              opacity: active ? 0.4 + val * 0.6 : 0.2,
            }}
          />
        );
      })}
    </div>
  );
}
