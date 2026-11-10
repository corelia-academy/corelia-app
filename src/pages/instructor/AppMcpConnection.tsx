import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function AppMcpConnection() {
  const { t } = useTranslation("instructor");
  const [client, setClient] = useState<"codex" | "claude">("codex");
  const [notice, setNotice] = useState("");
  const base = (import.meta.env.VITE_SUPABASE_URL?.trim() ?? "").replace(/\/+$/, "");
  const endpoint = base ? `${base}/functions/v1/app-mcp` : "";
  const command = client === "codex"
    ? `codex mcp add corelia-app --url ${endpoint} && codex mcp login corelia-app`
    : `claude mcp add --transport http corelia-app --scope user ${endpoint} && claude mcp login corelia-app`;
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(t("mcpConnection.copied")); }
    catch { setNotice(t("mcpConnection.copyFailed")); }
  };
  return (
    <details className="mb-4 rounded-2xl border border-border-subtle bg-surface-base p-4">
      <summary className="cursor-pointer font-semibold">{t("mcpConnection.title")}</summary>
      <p className="mt-3 text-sm text-foreground-muted">{t("mcpConnection.description")}</p>
      {!endpoint ? <p role="alert">{t("mcpConnection.unavailable")}</p> : <div className="mt-4 space-y-3">
        <label className="block text-sm" htmlFor="mcp-client">{t("mcpConnection.client")}</label>
        <select id="mcp-client" value={client} onChange={(e) => setClient(e.target.value as "codex" | "claude")} className="rounded border border-border-subtle bg-surface-base p-2">
          <option value="codex">Codex CLI</option><option value="claude">Claude Code</option>
        </select>
        <pre className="overflow-x-auto rounded border border-border-subtle p-3 text-sm"><code>{command}</code></pre>
        <Button type="button" onClick={() => void copy(command)}>{t("mcpConnection.copyCommand")}</Button>{" "}
        <Button type="button" variant="cta" hierarchy="secondary" onClick={() => void copy(endpoint)}>{t("mcpConnection.copyUrl")}</Button>
        <p className="text-sm text-foreground-muted">{t("mcpConnection.existing")}</p>
        <p className="text-sm">{t("mcpConnection.prompt")}</p>
        <p className="text-sm text-foreground-muted">{t("mcpConnection.availability")}</p>
        <p role="status">{notice}</p>
      </div>}
    </details>
  );
}
