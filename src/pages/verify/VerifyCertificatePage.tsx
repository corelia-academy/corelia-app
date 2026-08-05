import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ExternalLink, Loader2, SearchX, ShieldX } from "lucide-react";

import { invokeVerifyCertificate, type VerifiedCertificate } from "@/lib/certificatesEdge";
import { openCampusCredentialExplorerUrl } from "@/lib/credentialIssuances";
import { intlLocale } from "@/lib/intl";
import { renderCertificateBlob } from "@/pages/achievements/utils/renderCertificate";

type Status = "idle" | "loading" | "valid" | "revoked" | "notfound" | "error";

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(intlLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Public, no-auth certificate verification.
 *
 *  The text facts below ARE the proof — they come from the verification RPC, which
 *  reads immutable snapshots taken at issuance. The certificate image is decoration,
 *  re-rendered from the course template rather than loaded from
 *  cdn/certificates/{userId}/{courseId}.png, because that file is uploaded by the
 *  learner and so cannot be trusted as evidence. */
export function VerifyCertificatePage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { code: codeParam } = useParams();
  const code = (codeParam ?? "").trim();

  // Tagged with the code it belongs to, so status/result can be derived rather than
  // reset from inside an effect when the URL changes.
  const [fetched, setFetched] = useState<{
    code: string;
    status: Status;
    result: VerifiedCertificate | null;
  }>({ code: "", status: "idle", result: null });
  const [input, setInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const settled = fetched.code === code;
  const status: Status = !code ? "idle" : settled ? fetched.status : "loading";
  const result = settled ? fetched.result : null;

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    invokeVerifyCertificate(code)
      .then((res) => {
        if (cancelled) return;
        const next: Status = res.status === "valid"
          ? "valid"
          : res.status === "revoked"
            ? "revoked"
            : "notfound";
        setFetched({ code, status: next, result: res });
      })
      .catch(() => {
        if (!cancelled) setFetched({ code, status: "error", result: null });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Re-render the artifact from trusted data once we have a verified result.
  useEffect(() => {
    const template = result?.certificate_template_url?.trim();
    if (!template || (status !== "valid" && status !== "revoked")) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    renderCertificateBlob({
      imageUrl: template,
      holderName: result?.holder_name ?? null,
      verificationCode: result?.code ?? null,
      issuedAtIso: result?.issued_at ?? null,
      nameXPercent: result?.certificate_name_x_percent ?? null,
      nameYPercent: result?.certificate_name_y_percent ?? null,
      nameSizePercent: result?.certificate_name_size_percent ?? null,
      nameColor: result?.certificate_name_color ?? null,
      footerXPercent: result?.certificate_footer_x_percent ?? null,
      footerYPercent: result?.certificate_footer_y_percent ?? null,
      footerSizePercent: result?.certificate_footer_size_percent ?? null,
      footerColor: result?.certificate_footer_color ?? null,
      qrXPercent: result?.certificate_qr_x_percent ?? null,
      qrYPercent: result?.certificate_qr_y_percent ?? null,
      qrSizePercent: result?.certificate_qr_size_percent ?? null,
    })
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        // Decoration only — a failed render must not affect the verdict.
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    };
  }, [result, status]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = input.trim();
    if (next) navigate(`/verify/${encodeURIComponent(next)}`);
  }

  const ocUrl = openCampusCredentialExplorerUrl(result?.oc_credential_id);

  const searchForm = (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 text-left">
      <label htmlFor="certificate-code" className="text-sm font-medium text-foreground">
        {t("verify.inputLabel")}
      </label>
      <input
        id="certificate-code"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        placeholder={t("verify.inputPlaceholder")}
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 w-full rounded-md border border-border-subtle bg-surface-raised px-3 font-mono text-sm text-foreground placeholder:text-foreground-muted"
      />
      <button
        type="submit"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        {t("verify.submit")}
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-base shadow-card p-8 text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-foreground-muted">{t("verify.loading")}</p>
          </div>
        )}

        {status === "idle" && (
          <>
            <h1 className="text-xl font-semibold text-foreground">{t("verify.formTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("verify.formHint")}</p>
            {searchForm}
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-semibold text-foreground">{t("verify.errorTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("verify.errorBody")}</p>
            {searchForm}
          </>
        )}

        {status === "notfound" && (
          <>
            <SearchX className="mx-auto size-10 text-foreground-muted" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold text-foreground">{t("verify.notFoundTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("verify.notFoundBody")}</p>
            {searchForm}
          </>
        )}

        {(status === "valid" || status === "revoked") && result && (
          <>
            {status === "valid" ? (
              <>
                <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
                <h1 className="mt-3 text-xl font-semibold text-foreground">{t("verify.validTitle")}</h1>
                <p className="mt-2 text-sm text-foreground-muted">{t("verify.validSubtitle")}</p>
              </>
            ) : (
              <>
                <ShieldX className="mx-auto size-10 text-destructive" aria-hidden />
                <h1 className="mt-3 text-xl font-semibold text-foreground">{t("verify.revokedTitle")}</h1>
                <p className="mt-2 text-sm text-foreground-muted">
                  {t("verify.revokedBody", { date: formatDate(result.revoked_at) })}
                </p>
                {result.revoked_reason && (
                  <p className="mt-1 text-sm text-foreground-muted">
                    {t("verify.revokedReason", { reason: result.revoked_reason })}
                  </p>
                )}
              </>
            )}

            <dl className="mt-5 space-y-3 rounded-lg border border-border-subtle bg-surface-raised p-4 text-left">
              <div>
                <dt className="text-xs font-medium text-foreground-muted">{t("verify.holderLabel")}</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {result.holder_name || t("verify.unknownHolder")}
                  {result.holder_path && (
                    <Link to={result.holder_path} className="ml-2 text-xs font-normal text-primary hover:underline">
                      {t("verify.viewProfile")}
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">{t("verify.courseLabel")}</dt>
                <dd className="text-sm text-foreground">
                  {result.course_title || t("verify.unknownCourse")}
                  {result.course_path && (
                    <Link to={result.course_path} className="ml-2 text-xs text-primary hover:underline">
                      {t("verify.viewCourse")}
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">{t("verify.instructorLabel")}</dt>
                <dd className="text-sm text-foreground">
                  {result.instructor_name || t("verify.unknownInstructor")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">{t("verify.issuedLabel")}</dt>
                <dd className="text-sm text-foreground">{formatDate(result.issued_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">{t("verify.codeLabel")}</dt>
                <dd className="font-mono text-sm text-foreground">{result.code}</dd>
              </div>
            </dl>

            {ocUrl && (
              <a
                href={ocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-subtle px-4 text-sm font-semibold text-foreground hover:bg-surface-raised"
              >
                {t("verify.viewOnchain")}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            )}

            {previewUrl && (
              <img
                src={previewUrl}
                alt=""
                className="mt-5 w-full rounded-lg border border-border-subtle"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
