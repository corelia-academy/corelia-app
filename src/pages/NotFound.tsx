import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation("common");

  return (
    <div className="container-app flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-6xl font-semibold tabular-nums text-muted-foreground">
        404
      </p>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold text-foreground">
          {t("notFound.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("notFound.description")}</p>
      </div>
      <Button render={<Link to="/" />} nativeButton={false} variant="default">
        {t("notFound.backHome")}
      </Button>
    </div>
  );
}
