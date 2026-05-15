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
};

export type MessageComplexity = "simple" | "medium" | "complex";
