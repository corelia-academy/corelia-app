import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuSearch,
  DropdownMenuTriggerWithIndicator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { normalizeTaxonomySearch, type ProjectTaxonomyOption } from "@/lib/projectTaxonomy";

const MAX_ITEMS = 20;
const MAX_CUSTOM_LENGTH = 80;

export function ProjectTaxonomyPicker({ label, options, selectedIds, customValues, searchPlaceholder, addLabel, limitLabel, onChange, presentation = "default" }: {
  label: string;
  options: ProjectTaxonomyOption[];
  selectedIds: string[];
  customValues: string[];
  searchPlaceholder: string;
  addLabel: (value: string) => string;
  limitLabel: string;
  onChange: (ids: string[], custom: string[]) => void;
  presentation?: "default" | "submission";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalized = normalizeTaxonomySearch(query);
  const filtered = useMemo(() => options.filter((option) => normalizeTaxonomySearch(option.name).includes(normalized)), [normalized, options]);
  const selected = options.filter((option) => selectedIds.includes(option.id));
  const total = selectedIds.length + customValues.length;
  const exactOption = options.find((option) => normalizeTaxonomySearch(option.name) === normalized);
  const exactCustom = customValues.some((value) => normalizeTaxonomySearch(value) === normalized);
  const canAdd = Boolean(query.trim()) && query.trim().length <= MAX_CUSTOM_LENGTH && !exactOption && !exactCustom && total < MAX_ITEMS;

  function addCustom() {
    const value = query.trim().replace(/\s+/g, " ");
    if (!canAdd || !value) return;
    onChange(selectedIds, [...customValues, value]);
    setQuery("");
  }

  return (
    <fieldset>
      <legend className="text-label-medium font-body">{label}</legend>
      {presentation === "default" ? <details className="group mt-3 rounded-lg border border-border bg-background">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm text-foreground-muted">{searchPlaceholder}<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
        <div className="border-t border-border p-3">
          <Input value={query} maxLength={MAX_CUSTOM_LENGTH} placeholder={searchPlaceholder} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && canAdd) { event.preventDefault(); addCustom(); } }} />
          <div className="scrollbar-design mt-2 max-h-64 space-y-1 overflow-y-auto">
            {filtered.map((option) => {
              const checked = selectedIds.includes(option.id);
              const disabled = !checked && total >= MAX_ITEMS;
              return <button key={option.id} type="button" disabled={disabled} aria-pressed={checked} className={cn("flex min-h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm hover:bg-surface-raised disabled:opacity-50", checked && "text-primary")} onClick={() => onChange(checked ? selectedIds.filter((id) => id !== option.id) : [...selectedIds, option.id], customValues)}>{option.name}{checked ? <Check className="size-4" /> : null}</button>;
            })}
            {canAdd ? <button type="button" className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-primary hover:bg-primary/5" onClick={addCustom}><Plus className="size-4" />{addLabel(query.trim())}</button> : null}
            {total >= MAX_ITEMS ? <p className="px-3 py-2 text-xs text-foreground-muted">{limitLabel}</p> : null}
          </div>
        </div>
      </details> : <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTriggerWithIndicator
          className="mt-3 flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-left text-body-large text-foreground-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={searchPlaceholder}
          aria-expanded={open}
        >
          {searchPlaceholder}
        </DropdownMenuTriggerWithIndicator>
        <DropdownMenuContent
          layout="multiple-list"
          sideOffset={4}
          className="w-(--anchor-width) min-w-0 gap-2"
        >
          <DropdownMenuSearch>
            <Input
              type="search"
              variant="icon-leading"
              leadingIconClassName="text-dropdown-supporting"
              statusIcon={null}
              controlClassName="h-10 gap-sm rounded-lg border-dropdown-input-border bg-dropdown-surface px-md focus-within:ring-dropdown-focus"
              className="text-body-large text-dropdown-title placeholder:text-dropdown-supporting"
              value={query}
              maxLength={MAX_CUSTOM_LENGTH}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canAdd) {
                  event.preventDefault();
                  addCustom();
                  setOpen(false);
                }
              }}
            />
          </DropdownMenuSearch>
          <DropdownMenuList>
            {filtered.map((option) => {
              const checked = selectedIds.includes(option.id);
              const disabled = !checked && total >= MAX_ITEMS;
              return (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={checked}
                  disabled={disabled}
                  size="compact"
                  onCheckedChange={(nextChecked, eventDetails) => {
                    eventDetails.cancel();
                    onChange(
                      nextChecked
                        ? [...selectedIds, option.id]
                        : selectedIds.filter((id) => id !== option.id),
                      customValues,
                    );
                  }}
                >
                  <DropdownMenuItemContent>{option.name}</DropdownMenuItemContent>
                </DropdownMenuCheckboxItem>
              );
            })}
            {canAdd ? (
              <DropdownMenuItem
                onClick={() => {
                  addCustom();
                  setOpen(false);
                }}
              >
                <Plus className="size-4 text-primary" aria-hidden />
                <DropdownMenuItemContent>{addLabel(query.trim())}</DropdownMenuItemContent>
              </DropdownMenuItem>
            ) : null}
            {total >= MAX_ITEMS ? <p className="px-3 py-2 text-xs text-dropdown-supporting">{limitLabel}</p> : null}
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>}
      {(selected.length > 0 || customValues.length > 0) ? <div className="mt-3 flex flex-wrap gap-2md">
        {[...selected.map((item) => ({ key: item.id, name: item.name, custom: false })), ...customValues.map((name) => ({ key: `custom:${name}`, name, custom: true }))].map((item) => {
          const removeItem = () => item.custom
            ? onChange(selectedIds, customValues.filter((value) => value !== item.name))
            : onChange(selectedIds.filter((id) => id !== item.key), customValues);
          const removeButton = (
            <Button type="button" variant="cta" hierarchy="tertiary" iconOnly size="xsmall" className="size-3 rounded-full p-0" aria-label={`${label}: ${item.name}`} onClick={removeItem}>
              <X className="size-3" />
            </Button>
          );

          return (
            <Tag key={item.key} type="label" size="small" className="gap-2 leading-[1.4]">
              {item.name}
              {removeButton}
            </Tag>
          );
        })}
      </div> : null}
    </fieldset>
  );
}
