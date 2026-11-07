export const AGENT_ROLES = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const MODEL_ALIASES = ["haiku", "sonnet", "opus", "fable"] as const;
export type ModelAlias = (typeof MODEL_ALIASES)[number];

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export type AgentModelOverrides = Partial<Record<AgentRole, ModelAlias>>;
export type AgentEffortOverrides = Partial<Record<AgentRole, EffortLevel>>;
export type AgentModels = Record<AgentRole, ModelAlias>;
export type AgentEfforts = Record<AgentRole, EffortLevel>;

export const DEFAULT_AGENT_MODELS: AgentModels = {
  A1: "haiku",
  A2: "haiku",
  A3: "haiku",
  A4: "haiku",
  A5: "haiku",
  A6: "haiku",
  A7: "haiku",
};

// Match Studio's current per-agent reasoning profile: A1=max, A5=high, others=xhigh.
export const DEFAULT_AGENT_EFFORTS: AgentEfforts = {
  A1: "max",
  A2: "xhigh",
  A3: "xhigh",
  A4: "xhigh",
  A5: "high",
  A6: "xhigh",
  A7: "xhigh",
};

export function resolveAgentModels(overrides?: AgentModelOverrides | null): AgentModels {
  return { ...DEFAULT_AGENT_MODELS, ...overrides };
}

export function resolveAgentEfforts(overrides?: AgentEffortOverrides | null): AgentEfforts {
  return { ...DEFAULT_AGENT_EFFORTS, ...overrides };
}
