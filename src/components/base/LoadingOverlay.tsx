import { Loader2 } from "lucide-react";

/** Full-viewport blocking overlay for synchronous lookups (e.g. admin UID/email search)
 *  where the user must not interact with anything else until the result comes back.
 *  Not dismissible — no onClick/onOpenChange, unlike Dialog's overlay. */
export function LoadingOverlay({ show, label }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm">
      <Loader2 className="size-8 animate-spin text-white" aria-hidden />
      {label ? <p className="text-sm font-medium text-white">{label}</p> : null}
    </div>
  );
}
