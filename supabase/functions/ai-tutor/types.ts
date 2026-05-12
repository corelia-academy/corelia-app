export type QuotaResult = {
  allowed: boolean;
  throttled: boolean;
  haikuOnly: boolean;
  monthlyUsed: number;
  monthlyLimit: number | null;
  dailyUsed: number;
  dailySoftCap: number | null;
  tier: "free" | "student" | "pro" | "bootcamp";
};
