import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OCConnect } from "@opencampus/ocid-connect-js";
import { ThemeProvider } from "next-themes";
import "../../src/i18n";
import MainLayout from "../../src/components/layouts/MainLayout";
import LearnLayout from "../../src/pages/learn/LearnLayout";
import "../../src/styles/globals.css";
import "../../src/styles/brand-palette.css";

const params = new URLSearchParams(location.search);
const route = params.get("route") || "/feed";
const theme = params.get("theme") === "dark" ? "dark" : "light";
const sample = <section className="m-4 rounded-2xl border border-border bg-card p-6 text-card-foreground"><h1>Navigation fixture</h1><p>Route: {route}. Local shell preview only; no private content or actions.</p></section>;
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <OCConnect opts={{ clientId: import.meta.env.VITE_OCID_CLIENT_ID, redirectUri: import.meta.env.VITE_OCID_REDIRECT_URI }} sandboxMode>
      <ThemeProvider attribute="class" forcedTheme={theme} defaultTheme={theme} enableSystem={false} storageKey="corelia-navigation-fixture">
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={route.startsWith("/learn/") ? <LearnLayout /> : <MainLayout />}>
              <Route path="*" element={sample} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </OCConnect>
  </QueryClientProvider>,
);
