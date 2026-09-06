import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./styles/globals.css";
import "./i18n";
import App from "./App";
import { OCConnect } from "@opencampus/ocid-connect-js";
import { queryClient } from "@/lib/queryClient";
import { installStaleChunkRecovery } from "@/lib/staleChunkRecovery";
declare global {
  interface Window {
    __CORELIA_BUILD__?: { version: string };
  }
}

window.__CORELIA_BUILD__ = {
  version: import.meta.env.VITE_APP_VERSION,
};

installStaleChunkRecovery({ buildVersion: import.meta.env.VITE_APP_VERSION });

const ocidOpts = {
  clientId: import.meta.env.VITE_OCID_CLIENT_ID,
  redirectUri: import.meta.env.VITE_OCID_REDIRECT_URI,
  referralCode: "CORELIA",
} as const;

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <OCConnect opts={ocidOpts} sandboxMode={import.meta.env.VITE_OCID_SANDBOX === "true"}>
      <App />
    </OCConnect>
  </QueryClientProvider>,
);
