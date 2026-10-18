// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  output: "static",

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["gsap", "gsap/ScrollTrigger", "gsap/SplitText"],
    },
  },

  integrations: [react()],

  i18n: {
    locales: ["vi", "en"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
