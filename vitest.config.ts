import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "https://esm.sh/@supabase/supabase-js@2.49.8": "@supabase/supabase-js",
      "npm:react@19.2.0": "react",
      "npm:satori@0.33.5": "satori",
      "npm:@resvg/resvg-wasm@2.6.2": "@resvg/resvg-wasm",
      "npm:@humation/core@1.0.3": "@humation/core",
      "npm:@humation/assets-humation-1@1.0.3": "@humation/assets-humation-1",
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "supabase/functions/**/*.test.ts",
      "supabase/functions/**/*.test.tsx",
      "worker/**/*.test.ts",
    ],
  },
});
