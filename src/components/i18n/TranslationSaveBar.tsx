import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function TranslationSaveBar({
  dirty,
  saving,
  disabled,
  lastSavedAt,
  onSave,
  left,
  saveLabel = "Save",
}: {
  dirty: boolean;
  saving?: boolean;
  disabled?: boolean;
  lastSavedAt?: string | null;
  onSave: () => void;
  left?: ReactNode;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        {left}
        <div className="text-xs text-foreground-muted">
          {lastSavedAt ? `Updated: ${new Date(lastSavedAt).toLocaleString()}` : null}
        </div>
      </div>
      <Button type="button" onClick={onSave} disabled={!dirty || Boolean(disabled) || Boolean(saving)}>
        {saving ? "Saving…" : saveLabel}
      </Button>
    </div>
  );
}

