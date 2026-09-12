import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLearningTranslation } from "./useLearningTranslation";

/** Resolves false on dismissal/unmount; callers never mutate before approval. */
export function useLearningConfirm() {
  const { t } = useLearningTranslation();
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const settle = useCallback((accepted: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setMessage(null);
    resolve?.(accepted);
  }, []);
  const confirm = useCallback((next: string): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise(resolve => { pending.current = resolve; setMessage(next); });
  }, []);
  const confirmation = <Dialog open={message !== null} onOpenChange={open => { if (!open) settle(false); }}>
    <DialogContent className="sm:max-w-lg" showCloseButton={false} initialFocus={cancelButton}>
      <DialogTitle>{t("learning.confirmTitle")}</DialogTitle>
      <DialogDescription>{message}</DialogDescription>
      <DialogFooter>
        <Button ref={cancelButton} type="button" variant="outline" onClick={() => settle(false)}>{t("learning.cancel")}</Button>
        <Button type="button" onClick={() => settle(true)}>{t("learning.confirmAction")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
  return { confirm, confirmation };
}
