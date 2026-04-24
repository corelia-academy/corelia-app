import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
};

export default function OpenCampusConnectDialog(props: Props) {
  const { open, onOpenChange, onConnect, disabled, loading, error } = props;
  const { t } = useTranslation("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/40 overflow-hidden">
              <img
                src="/logo/OC-square-logo.svg"
                alt={t("openCampusConnect.modal.logoAlt")}
              />
            </div>
            <div className="min-w-0">
              <DialogTitle>{t("openCampusConnect.modal.title")}</DialogTitle>
              <DialogDescription className="mt-1">
                {t("openCampusConnect.modal.description")}{" "}
                <a
                  href="https://id.opencampus.xyz/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("openCampusConnect.modal.learnMoreLink", {
                    defaultValue: "Learn more",
                  })}
                </a>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-md border border-border-subtle bg-muted/20 p-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-4">
            <li>{t("openCampusConnect.modal.benefits.0")}</li>
            <li>{t("openCampusConnect.modal.benefits.1")}</li>
            <li>{t("openCampusConnect.modal.benefits.2")}</li>
          </ul>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("openCampusConnect.modal.later")}
          </Button>
          <Button
            type="button"
            onClick={onConnect}
            disabled={disabled || loading}
          >
            {loading
              ? t("openCampusConnect.modal.connecting")
              : t("openCampusConnect.modal.connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
