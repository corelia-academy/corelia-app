import { useMemo, useState } from "react";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { updateOCIDProfile } from "@/lib/profile";

function truncateMiddle(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default function ConnectOCIDCard() {
  const { profile, refreshProfile } = useAuth();
  const { isInitialized, authState, ocAuth } = useOCAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const connected = Boolean(profile?.ocid);

  const ocidDisplay = useMemo(() => {
    const ocid = profile?.ocid ?? null;
    if (!ocid) return null;
    return truncateMiddle(ocid, 8, 6);
  }, [profile?.ocid]);

  const ethDisplay = useMemo(() => {
    const addr = profile?.ocid_eth_address ?? null;
    if (!addr) return null;
    return truncateMiddle(addr, 10, 6);
  }, [profile?.ocid_eth_address]);

  async function handleConnect() {
    setError(null);
    setSuccess(null);
    try {
      if (!isInitialized) return;
      setLoading(true);
      await ocAuth.signInWithRedirect({ state: "corelia-ocid-connect" });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Không thể bắt đầu kết nối OCID.";
      setError(message);
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await updateOCIDProfile({ ocid: null, ocid_eth_address: null });
      await refreshProfile();
      setSuccess("Đã hủy liên kết OCID.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Không thể hủy liên kết OCID.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium">Kết nối OCID</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Liên kết Open Campus ID để đồng bộ danh tính và ví (nếu có) trong hệ sinh thái Open Campus.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
          {connected ? "Đã kết nối" : "Chưa kết nối"}
        </span>
      </div>

      {!isInitialized ? (
        <div className="rounded-lg border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          Đang khởi tạo OCID SDK…
        </div>
      ) : authState.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {authState.error.message}
        </div>
      ) : connected ? (
        <div className="grid gap-3 rounded-lg border border-border-subtle bg-background p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-muted-foreground">OCID</div>
            <div className="font-mono text-foreground">
              {ocidDisplay ?? profile?.ocid ?? "—"}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-muted-foreground">ETH Address</div>
            <div className="font-mono text-foreground">
              {ethDisplay ?? profile?.ocid_eth_address ?? "—"}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          Bấm nút bên dưới để liên kết OCID với tài khoản Corelia của bạn.
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {connected ? (
          <Button
            type="button"
            variant="destructive"
            disabled={loading}
            onClick={() => void handleDisconnect()}
          >
            {loading ? "Đang xử lý…" : "Disconnect"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={loading || !isInitialized}
            onClick={() => void handleConnect()}
          >
            {loading ? "Đang chuyển hướng…" : "Connect with OCID"}
          </Button>
        )}
      </div>
    </section>
  );
}

