import {
  Award,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Download,
  GraduationCap,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CERT_PLACEHOLDER } from "../constants";
import type { CertificateItem, ModalItem } from "../types";
import { OcClaimBadge } from "./OcClaimBadge";

export function CertificateCard({
  cert,
  onOpenModal,
}: {
  cert: CertificateItem;
  onOpenModal: (item: ModalItem) => void;
}) {
  const { t } = useTranslation("common");
  const imageUrl = cert.imageUrl ?? CERT_PLACEHOLDER;
  return (
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5">
      <div
        className={cn(
          "h-1.5 w-full shrink-0",
          cert.type === "online"
            ? "bg-linear-to-r from-primary/80 via-primary to-primary/60"
            : "bg-linear-to-r from-on-primary-container/80 via-on-primary-container to-primary/70",
        )}
      />

      {/* Certificate preview — fixed 4:3 aspect ratio with name overlay */}
      <div className="relative w-full shrink-0 overflow-hidden bg-surface-raised" style={{ aspectRatio: "4/3" }}>
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover transition-opacity duration-200 group-hover:opacity-95"
        />
        {cert.holderName && imageUrl !== CERT_PLACEHOLDER && (
          <span
            className="pointer-events-none absolute max-w-[70%] truncate text-center text-[clamp(0.55rem,1.8cqw,0.85rem)] font-semibold leading-tight"
            style={{
              left: `${cert.nameXPercent ?? 50}%`,
              top: `${cert.nameYPercent ?? 50}%`,
              transform: "translate(-50%, -50%)",
              color: "inherit",
              textShadow: "0 0 6px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.6)",
              mixBlendMode: "multiply",
            }}
          >
            {cert.holderName}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md sm:size-10",
                cert.type === "online"
                  ? "bg-primary/10 text-primary"
                  : "bg-primary-muted text-primary",
              )}
            >
              <Award className="size-4 sm:size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                  cert.type === "online"
                    ? "bg-primary/10 text-primary"
                    : "bg-primary-muted text-primary",
                )}
              >
                {cert.type === "online"
                  ? t("achievements.certificates.type.online")
                  : t("achievements.certificates.type.offline")}
              </span>
              <p className="mt-0.5 line-clamp-1 text-xs text-foreground-muted">
                {cert.title}
              </p>
            </div>
          </div>
          <BadgeCheck
            className="size-4 shrink-0 text-success sm:size-5"
            aria-hidden
          />
        </div>

        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
          {cert.course}
        </h3>

        <div className="mt-2 space-y-1 text-sm text-foreground-muted">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{cert.instructor}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 shrink-0" aria-hidden />
            <span>
              {t("achievements.certificates.issuedOnPrefix", {
                date: cert.issuedAt,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="size-3.5 shrink-0 text-success"
              aria-hidden
            />
            <span className="truncate font-mono text-xs">{cert.credentialId}</span>
          </div>
        </div>

        <div className="mt-2">
          <OcClaimBadge status={cert.ocClaimStatus} />
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-stretch gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenModal({ kind: "cert", data: cert })}
            className={cn(
              cert.ocClaimStatus === "claimed"
                ? "border-success/20 bg-success/10 text-success hover:bg-success/15"
                : "border-border bg-surface-base hover:bg-surface-raised",
            )}
          >
            <img
              src="/open-campus-edu-logo.png"
              alt="OC"
              className="size-3.5 shrink-0 rounded-full sm:size-4"
            />
            <span className="truncate">
              {cert.ocClaimStatus === "claimed"
                ? t("achievements.certificates.ocAction.view")
                : t("achievements.certificates.ocAction.claim")}
            </span>
          </Button>
          <Button type="button" variant="ghost" title={t("actions.download")}>
            <Download className="size-4 shrink-0" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
