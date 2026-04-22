import { useMemo, useState } from "react";
import { CheckIcon, CaretDownIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ProfileComboboxOption {
  id: string;
  label: string;
  description?: string | null;
}

interface ProfileComboboxProps {
  title: string;
  description?: string;
  options: ProfileComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
}

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export function ProfileCombobox({
  title,
  description,
  options,
  placeholder,
  searchPlaceholder = "Tìm theo tên hoặc email",
  emptyLabel = "Không có kết quả phù hợp.",
  value,
  onChange,
  multiple = false,
}: ProfileComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedIds = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );
  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) => {
      const haystack = normalize(
        `${option.label} ${option.description ?? ""} ${option.id}`,
      );
      return haystack.includes(q);
    });
  }, [options, query]);
  const selectedLabels = useMemo(
    () =>
      selectedIds
        .map((id) => options.find((option) => option.id === id)?.label)
        .filter(Boolean) as string[],
    [options, selectedIds],
  );

  function toggleOption(id: string) {
    if (multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id];
      onChange(next);
      return;
    }
    onChange(id);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left"
        onClick={() => setOpen(true)}
      >
        <div className="min-w-0">
          {selectedLabels.length === 0 ? (
            <div className="text-sm text-muted-foreground">{placeholder}</div>
          ) : multiple ? (
            <div className="flex flex-wrap gap-2">
              {selectedLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-2.5 py-1 text-[12px] font-medium text-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-foreground">{selectedLabels[0]}</div>
          )}
        </div>
        <CaretDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-0">
          <DialogHeader className="border-b border-border-subtle px-5 py-4">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className="px-5 py-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              placeholder={searchPlaceholder}
            />

            <div className="mt-4 max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
                  {emptyLabel}
                </div>
              ) : (
                filtered.map((option) => {
                  const checked = selectedIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(option.id)}
                      className={`flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border-subtle bg-background hover:border-border"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {option.label}
                        </div>
                        {option.description ? (
                          <div className="mt-1 text-[13px] leading-5 text-muted-foreground">
                            {option.description}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`mt-0.5 inline-flex size-5 items-center justify-center rounded-full border ${
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border-subtle text-transparent"
                        }`}
                      >
                        <CheckIcon className="size-3.5" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {multiple ? (
              <div className="mt-4 flex justify-end">
                <Button type="button" onClick={() => setOpen(false)}>
                  Xong
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
