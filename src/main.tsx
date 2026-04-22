import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App";
import { OCConnect } from "@opencampus/ocid-connect-js";

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
