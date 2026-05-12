import type { Locale } from "@/types/database";

export function TranslationLocalePicker({
  value,
  onChange,
  supportedLocales,
  primaryLocale,
  disabled,
}: {
  value: Locale;
  onChange: (next: Locale) => void;
  supportedLocales: Locale[];
  primaryLocale: Locale;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="h-10 rounded-lg border border-border bg-surface-base px-3 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
        value={value}
        onChange={(e) => onChange((e.target.value === "en" ? "en" : "vi") as Locale)}
        disabled={disabled}
      >
        <option value="vi">vi</option>
        <option value="en">en</option>
      </select>
      <div className="text-xs text-foreground-muted">
        Primary: <b className="text-foreground">{primaryLocale}</b> · Supported:{" "}
        <b className="text-foreground">{supportedLocales.join(", ")}</b>
      </div>
    </div>
  );
}

