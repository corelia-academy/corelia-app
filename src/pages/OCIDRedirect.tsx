import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LoginCallBack, useOCAuth } from "@opencampus/ocid-connect-js";
import { updateOCIDProfile } from "@/lib/profile";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/stores/authStore";

function Loading() {
  return (
    <div className="container-app py-10">
      <div className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="text-sm text-muted-foreground">
            Đang hoàn tất liên kết OCID…
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorView() {
  const { authState } = useOCAuth();
  return (
    <div className="container-app py-10">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
        {authState.error?.message ?? "Không thể liên kết OCID. Vui lòng thử lại."}
      </div>
    </div>
  );
}

export default function OCIDRedirect() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { OCId, ethAddress, ocAuth } = useOCAuth();
  const [error, setError] = useState<string | null>(null);

  const callbacks = useMemo(() => {
    return {
      successCallback: async () => {
        setError(null);
        const user = auth.currentUser;
        if (!user) {
          setError("Bạn cần đăng nhập Corelia trước khi liên kết OCID.");
          navigate("/login", { replace: true });
          return;
        }

        const authState = ocAuth?.getAuthState?.();
        const resolvedOCId =
          (authState && "OCId" in authState ? (authState as any).OCId : undefined) ??
          OCId ??
          null;
        const resolvedEth =
          (authState && "ethAddress" in authState
            ? (authState as any).ethAddress
            : undefined) ??
          ethAddress ??
          null;

        if (!resolvedOCId) {
          setError("Không lấy được OCID từ phiên đăng nhập. Vui lòng thử kết nối lại.");
          navigate("/account", { replace: true });
          return;
        }

        await updateOCIDProfile({
          ocid: resolvedOCId,
          ocid_eth_address: resolvedEth,
        });
        await refreshProfile();
        navigate("/account", { replace: true });
      },
      errorCallback: (e: unknown) => {
        const message =
          e instanceof Error ? e.message : "Không thể liên kết OCID. Vui lòng thử lại.";
        setError(message);
      },
    };
  }, [OCId, ethAddress, navigate, ocAuth, refreshProfile]);

  return (
    <div className="min-h-[60vh]">
      {error ? (
        <div className="container-app py-10">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : null}
      <LoginCallBack
        customLoadingComponent={<Loading />}
        customErrorComponent={<ErrorView />}
        successCallback={callbacks.successCallback}
        errorCallback={callbacks.errorCallback}
      />
    </div>
  );
}

