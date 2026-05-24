import { cn } from "@/lib/utils";

export function SuggestionPills({
  suggestions,
  onSelect,
  disabled = false,
}: {
  suggestions: string[];
  onSelect: (label: string) => void;
  disabled?: boolean;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((label) => (
        <button
          key={label}
          type="button"
          className={cn(
            "max-w-full rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-left text-[11px] leading-snug text-foreground-muted",
            "transition-colors hover:border-border hover:bg-surface-overlay hover:text-foreground",
          )}
          disabled={disabled}
          onClick={() => onSelect(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
