import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles, XCircle } from "lucide-react";
import React from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

export const CREDENTIAL_SYNC_EVENT = "corelia:credential-sync";

export default function CredentialRealtimeSync() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel("public:credential_issuances")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "credential_issuances",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          const oldStatus = payload.old.status;

          // Only trigger if status changed
          if (newStatus !== oldStatus) {
            // Dispatch custom event to notify achievements page to reload data
            window.dispatchEvent(
              new CustomEvent(CREDENTIAL_SYNC_EVENT, { detail: payload.new })
            );

            if (newStatus === "minted") {
              toast.success(
                t("achievements.sync.mintedTitle", { defaultValue: "Đúc chứng nhận thành công!" }),
                {
                  description: t("achievements.sync.mintedDescription", { 
                    defaultValue: "OCB của bạn đã được đúc thành công và lưu trên blockchain." 
                  }),
                  icon: React.createElement(Sparkles, { className: "w-5 h-5 text-yellow-500" }),
                  duration: 6000,
                }
              );
            } else if (newStatus === "failed") {
              toast.error(
                t("achievements.sync.failedTitle", { defaultValue: "Đúc chứng nhận thất bại" }),
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, t]);

  return null;
}
