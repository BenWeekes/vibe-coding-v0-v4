export type AgentState = "idle" | "joining" | "listening" | "talking" | "disconnected";

export interface Message {
  id: string;
  role: "agent" | "user";
  text: string;
  final: boolean;
}

export interface EnvStatus {
  ready: boolean;
  missing: string[];
}
