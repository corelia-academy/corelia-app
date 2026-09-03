import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "https://esm.sh/@supabase/supabase-js@2.49.8": "@supabase/supabase-js",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "supabase/functions/**/*.test.ts"],
  },
});
