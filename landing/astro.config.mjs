// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://corelia.academy",
  // Marketing pages are prerendered; catalog pages (courses, hackathons, jobs) opt out
  // with `prerender = false` and render on the Cloudflare Worker.
  output: "static",
  adapter: cloudflare({ imageService: "passthrough" }),
  // No Astro sessions are used; this stops the adapter from requiring a SESSION KV binding.
  session: { driver: "null" },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["gsap", "gsap/ScrollTrigger", "gsap/SplitText"],
    },
  },

  integrations: [
    react(),
    // Static pages only; /sitemap-catalog.xml lists the server-rendered catalog.
    sitemap({
      filter: (page) => !/\/404\/?$/.test(page),
      // Pages are served without a trailing slash (wrangler html_handling) and canonicalised that way.
      serialize: (item) => ({ ...item, url: item.url.replace(/(?<=[^/])\/$/, "") }),
    }),
  ],

  i18n: {
    locales: ["vi", "en"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
