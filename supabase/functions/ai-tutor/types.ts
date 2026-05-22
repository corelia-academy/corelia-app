export type QuotaResult = {
  allowed: boolean;
  throttled: boolean;
  haikuOnly: boolean;
  monthlyUsed: number;
  monthlyLimit: number | null;
  windowUsed: number;
  windowSoftCap: number | null;
  windowHours: number;
  tier: "free" | "student" | "pro" | "bootcamp";
  quotaUnit: "message" | "token" | "both";
  monthlyTokensUsed: number;
  monthlyTokensLimit: number | null;
  rollingTokensUsed: number;
  rollingTokensCap: number | null;
};

export type MessageComplexity = "simple" | "medium" | "complex";
