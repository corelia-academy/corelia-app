import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import "./i18n";
import App from "./App";
import { OCConnect } from "@opencampus/ocid-connect-js";
import { supabase } from "@/lib/supabase";
import { installAuthDebugTelemetry } from "@/lib/authTelemetry";

declare global {
  interface Window {
    __CORELIA_BUILD__?: { version: string };
  }
}

window.__CORELIA_BUILD__ = {
  version: import.meta.env.VITE_APP_VERSION,
};

installAuthDebugTelemetry(supabase);

const ocidOpts = {
  clientId: import.meta.env.VITE_OCID_CLIENT_ID,
  redirectUri: import.meta.env.VITE_OCID_REDIRECT_URI,
  referralCode: "CORELIA",
} as const;

createRoot(document.getElementById("root")!).render(
  <OCConnect opts={ocidOpts} sandboxMode={import.meta.env.DEV}>
    <App />
  </OCConnect>,
);
