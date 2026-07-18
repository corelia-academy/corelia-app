import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Sparkles, XCircle } from "lucide-react";
import React from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

export const CREDENTIAL_SYNC_EVENT = "corelia:credential-sync";

function isResolvedMint(issuance: Record<string, unknown>) {
  return (
    issuance.status === "minted" &&
    typeof issuance.oc_credential_id === "string" &&
    issuance.oc_credential_id.trim().length > 0 &&
    issuance.error_message !== "credential_id_unresolved"
  );
}

export default function CredentialRealtimeSync() {
  const { user, isAuthenticated, profile } = useAuth();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const achievementsPath = profile?.username
    ? `/@${encodeURIComponent(profile.username)}`
    : "/account";

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel("public:credential_issuances")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credential_issuances",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const status = payload.new.status;
            window.dispatchEvent(
              new CustomEvent(CREDENTIAL_SYNC_EVENT, { detail: payload.new })
            );

            if (status === "pending") {
              toast.info(
                t("achievements.sync.pendingTitle", { defaultValue: "Đang tạo chứng nhận..." }),
                {
                  description: t("achievements.sync.pendingDescription", { 
                    defaultValue: "Hệ thống đang ghi nhận và tạo OCB của bạn trên blockchain." 
                  }),
                  duration: 4000,
                }
              );
            } else if (isResolvedMint(payload.new)) {
              toast.success(
                t("achievements.sync.mintedTitle", { defaultValue: "Tạo chứng nhận thành công!" }),
                {
                  description: t("achievements.sync.mintedDescription", { 
                    defaultValue: "OCB của bạn đã được tạo thành công và lưu trên blockchain." 
                  }),
                  icon: React.createElement(Sparkles, { className: "w-5 h-5 text-yellow-500" }),
                  action: {
                    label: t("notifications.viewCredential"),
                    onClick: () => navigate(achievementsPath),
                  },
                  duration: 6000,
                }
              );
            }
          } else if (payload.eventType === "UPDATE") {
            const newStatus = payload.new.status;
            const oldStatus = payload.old?.status;
            const holderStateChanged =
              payload.new.error_message !== payload.old?.error_message;
            const statusChanged = newStatus !== oldStatus;

            if (statusChanged || holderStateChanged) {
              window.dispatchEvent(
                new CustomEvent(CREDENTIAL_SYNC_EVENT, { detail: payload.new })
              );

              // Error metadata can change a pending issuance into an actionable
              // UI state (for example awaiting_holder_id) without changing the
              // database status. Reload achievements, but do not repeat a mint
              // toast unless the status itself changed.
              if (!statusChanged) return;

              if (isResolvedMint(payload.new)) {
                toast.success(
                  t("achievements.sync.mintedTitle", { defaultValue: "Tạo chứng nhận thành công!" }),
                  {
                    description: t("achievements.sync.mintedDescription", { 
                      defaultValue: "OCB của bạn đã được tạo thành công và lưu trên blockchain." 
                    }),
                    icon: React.createElement(Sparkles, { className: "w-5 h-5 text-yellow-500" }),
                    action: {
                      label: t("notifications.viewCredential"),
                      onClick: () => navigate(achievementsPath),
                    },
                    duration: 6000,
                  }
                );
              } else if (newStatus === "failed") {
                toast.error(
                  t("achievements.sync.failedTitle", { defaultValue: "Tạo chứng nhận thất bại" }),
                  {
                    description: t("achievements.sync.failedDescription", { 
                      defaultValue: "Có lỗi xảy ra khi cấp phát OCB. Vui lòng thử lại sau." 
                    }),
                    icon: React.createElement(XCircle, { className: "w-5 h-5 text-red-500" }),
                    duration: 6000,
                  }
                );
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [achievementsPath, isAuthenticated, navigate, t, user?.id]);

  return null;
}
