import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function OgImagePreview({ imageUrl, onError, dark, onToggleDark }: {
  imageUrl: string; onError: () => void; dark: boolean; onToggleDark: () => void;
}) {
  const { t } = useTranslation("admin");
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground-muted">{t("ogPreview.image")}</span>
      <Button type="button" variant="outline" size="sm" onClick={onToggleDark}>
        {dark ? t("ogPreview.lightBackground") : t("ogPreview.darkBackground")}
      </Button>
    </div>
    <div className={`rounded-xl p-3 sm:p-6 ${dark ? "bg-[#090b16]" : "bg-white"}`}>
      <img src={imageUrl} alt={t("ogPreview.imageAlt")} onError={onError}
        className="mx-auto block w-full max-w-[1200px] rounded-lg object-contain"
        style={{ aspectRatio: "1200 / 630" }} />
    </div>
  </div>;
}
