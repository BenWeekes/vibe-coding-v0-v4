"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const VoiceAgent = dynamic(
  () => import("@/components/voice-agent/VoiceAgent").then((m) => m.VoiceAgent),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    ),
  }
);

export default function Page() {
  return <VoiceAgent />;
}
