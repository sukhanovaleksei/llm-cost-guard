export type GuardMode = "soft" | "hard";

export interface GuardConfig {
  defaultProjectId?: string;
  mode?: GuardMode;
}