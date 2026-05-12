import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function LoginSignUpPendingSection({
  email,
  onBackToSignIn,
}: {
  email: string;
  onBackToSignIn: () => void;
}) {
  const { t } = useTranslation("auth");
  return (
    <>
      <div
        className="flex gap-3 rounded-md border border-success/25 bg-success/10 p-4 text-left"
        role="status"
      >
        <Mail className="size-5 shrink-0 text-success" aria-hidden />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-medium text-success">{t("login.signUpAfterSubmit.body", { email })}</p>
          <p className="text-xs text-success/90">{t("login.signUpAfterSubmit.spamHint")}</p>
        </div>
      </div>

      <Field>
        <Button type="button" variant="outline" className="w-full rounded-md" onClick={onBackToSignIn}>
          {t("login.signUpAfterSubmit.backToSignIn")}
        </Button>
      </Field>
    </>
  );
}
