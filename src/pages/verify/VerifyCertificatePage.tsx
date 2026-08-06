import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ExternalLink, Loader2, SearchX, ShieldX } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  const [imageZoomOpen, setImageZoomOpen] = useState(false);

  // CSS shrink-to-fit (width: fit-content around an aspect-ratio'd <img> plus a
  // w-full sibling) does NOT resolve to the image's rendered width in practice —
  // measured it stretching to the full flex track instead. Measuring the actual
  // rendered width directly is the reliable way to make the "View on Open Campus"
  // link match the certificate image's width exactly.
  //
  // Deliberately NOT a ResizeObserver: its notification delivery is tied to the
  // rendering/paint pipeline, so it never fires on a backgrounded/non-composited
  // tab. onLoad + a resize listener both fire from ordinary DOM event dispatch —
  // decode-completion and the viewport resize event respectively — independent of
  // whether the tab is actually painting, so they work everywhere onLoad/resize do.
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const measureImage = () => {
    const width = imageRef.current?.getBoundingClientRect().width;
    if (width) setImageWidth(width);
  };
  useEffect(() => {
    window.addEventListener("resize", measureImage);
    return () => window.removeEventListener("resize", measureImage);
  }, []);

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
    // h-dvh (not min-h-screen) + no page scroll at ANY viewport width: the card fills
    // the viewport exactly and everything below the info strip (the certificate image)
    // flexes to whatever room is left. Same behaviour on phone and on a full laptop
    // window — no md: fallback to a taller, scrollable layout.
    <div className="flex h-dvh flex-col items-center justify-center bg-background p-4">
      <div className="flex h-full max-h-[min(48rem,calc(100dvh-2rem))] w-full flex-col rounded-2xl border border-border-subtle bg-surface-base shadow-card p-5 text-center">
        {status === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-foreground-muted">{t("verify.loading")}</p>
          </div>
        )}

        {status === "idle" && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <h1 className="text-xl font-semibold text-foreground">{t("verify.formTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("verify.formHint")}</p>
            {searchForm}
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <h1 className="text-xl font-semibold text-foreground">{t("verify.errorTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("verify.errorBody")}</p>
            {searchForm}
          </div>
        )}

        {status === "notfound" && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <SearchX className="mx-auto size-10 text-foreground-muted" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold text-foreground">{t("verify.notFoundTitle")}</h1>
            <p className="mt-2 text-sm text-foreground-muted">{t("verify.notFoundBody")}</p>
            {searchForm}
          </div>
        )}

        {(status === "valid" || status === "revoked") && result && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Fixed-height header + info strip. Never flexes — the image below eats
                whatever height this leaves. */}
            <div className="shrink-0">
              {status === "valid" ? (
                <>
                  <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
                  <h1 className="mt-2 text-lg font-semibold text-foreground">
                    {t("verify.validTitle")}
                  </h1>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("verify.validSubtitle")}
                  </p>
                </>
              ) : (
                <>
                  <ShieldX className="mx-auto size-8 text-destructive" aria-hidden />
                  <h1 className="mt-2 text-lg font-semibold text-foreground">
                    {t("verify.revokedTitle")}
                  </h1>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t("verify.revokedBody", { date: formatDate(result.revoked_at) })}
                  </p>
                  {result.revoked_reason && (
                    <p className="mt-1 text-xs text-foreground-muted">
                      {t("verify.revokedReason", { reason: result.revoked_reason })}
                    </p>
                  )}
                </>
              )}

              {/* Below md (real mobile-width windows, not just narrow desktop): stacked
                  list, one field per row — a horizontal-scrolling strip is bad UX on
                  touch, it hides fields off-screen with no visible affordance. At md+
                  there's room to lay all 5 out in one row: flex-row + justify-between
                  spreads them across the width, flex-wrap catches the case where they
                  still don't fit, and max-w-[13rem] on each field stops one long value
                  (a long course title) from swallowing the row and squeezing the rest —
                  it wraps inside its own column instead. */}
              <dl className="mt-3 flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised p-3 text-left md:flex-row md:flex-wrap md:justify-between md:gap-x-4 md:gap-y-3">
                <div className="md:max-w-[13rem]">
                  <dt className="text-[11px] font-medium text-foreground-muted md:text-xs">
                    {t("verify.holderLabel")}
                  </dt>
                  <dd className="text-xs font-semibold text-foreground md:text-sm">
                    {result.holder_name || t("verify.unknownHolder")}
                    {result.holder_path && (
                      <Link
                        to={result.holder_path}
                        className="ml-2 text-xs font-normal text-primary hover:underline"
                      >
                        {t("verify.viewProfile")}
                      </Link>
                    )}
                  </dd>
                </div>
                <div className="md:max-w-[13rem]">
                  <dt className="text-[11px] font-medium text-foreground-muted md:text-xs">
                    {t("verify.courseLabel")}
                  </dt>
                  <dd className="text-xs text-foreground md:text-sm">
                    {result.course_title || t("verify.unknownCourse")}
                    {result.course_path && (
                      <Link to={result.course_path} className="ml-2 text-xs text-primary hover:underline">
                        {t("verify.viewCourse")}
                      </Link>
                    )}
                  </dd>
                </div>
                <div className="md:max-w-[13rem]">
                  <dt className="text-[11px] font-medium text-foreground-muted md:text-xs">
                    {t("verify.instructorLabel")}
                  </dt>
                  <dd className="text-xs text-foreground md:text-sm">
                    {result.instructor_name || t("verify.unknownInstructor")}
                  </dd>
                </div>
                <div className="md:max-w-[13rem]">
                  <dt className="text-[11px] font-medium text-foreground-muted md:text-xs">
                    {t("verify.issuedLabel")}
                  </dt>
                  <dd className="text-xs text-foreground md:text-sm">
                    {formatDate(result.issued_at)}
                  </dd>
                </div>
                <div className="md:max-w-[13rem]">
                  <dt className="text-[11px] font-medium text-foreground-muted md:text-xs">
                    {t("verify.codeLabel")}
                  </dt>
                  <dd className="font-mono text-xs text-foreground md:text-sm">
                    {result.code}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Takes whatever vertical room the fixed block above left. min-h-0 is load-
                bearing: without it a flex child won't shrink below its image's intrinsic
                size, and the certificate would push the page into scrolling again.
                items-center + justify-center centers the [image + OC link] group inside it. */}
            {previewUrl && (
              <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                {/* aspect-[4/3] matches CANVAS_W/CANVAS_H in certificateLayout.ts exactly
                    (renderCertificateBlob always draws onto a 1600x1200 canvas) — the
                    <img> box itself is pre-shaped to the right ratio, so max-h-full/
                    max-w-full alone pick the largest fit with no letterboxing inside the
                    border. (Previously: h-full forced the box to full height regardless
                    of the width max-w-full then clamped it to, producing a stretched,
                    wrong-ratio box with visible empty space inside its own border.) */}
                <button
                  type="button"
                  onClick={() => setImageZoomOpen(true)}
                  className="min-h-0 flex-1 cursor-zoom-in"
                  aria-label={t("verify.zoomImage")}
                >
                  <img
                    ref={imageRef}
                    src={previewUrl}
                    alt=""
                    onLoad={measureImage}
                    className="aspect-[4/3] max-h-full max-w-full rounded-lg border border-border-subtle object-contain"
                  />
                </button>

                {/* Width pinned to the image's measured render width (see ResizeObserver
                    above) so the link sits directly under the certificate's footprint
                    instead of stretching the full card. */}
                {ocUrl && (
                  <a
                    href={ocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={imageWidth ? { width: imageWidth } : undefined}
                    className="inline-flex min-h-9 w-full max-w-full shrink-0 items-center justify-center gap-2 rounded-md border border-border-subtle px-4 text-xs font-semibold text-foreground hover:bg-surface-raised"
                  >
                    {t("verify.viewOnchain")}
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {previewUrl && (
        <Dialog open={imageZoomOpen} onOpenChange={setImageZoomOpen}>
          <DialogContent
            showCloseButton
            className="max-w-[calc(100vw-2rem)] w-fit border-none bg-transparent p-0 shadow-none sm:max-w-[calc(100vw-4rem)]"
          >
            <img
              src={previewUrl}
              alt=""
              className="max-h-[calc(100dvh-4rem)] max-w-full rounded-lg object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
