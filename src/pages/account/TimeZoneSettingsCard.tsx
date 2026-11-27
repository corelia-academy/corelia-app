import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSearch,
  DropdownMenuSearchInput,
  DropdownMenuTriggerWithIndicator,
} from "@/components/ui/dropdown-menu";
import { useTimeZone } from "@/hooks/useTimeZone";
import { intlLocale } from "@/lib/intl";
import { AUTO_TIMEZONE, detectTimeZone, listTimeZones, timeZoneOffsetLabel } from "@/lib/timezone";
import { SettingsRow } from "./SettingsLayout";

function zoneLabel(timeZone: string) {
  const offset = timeZoneOffsetLabel(timeZone);
  const name = timeZone.replaceAll("_", " ");
  return offset ? `(${offset}) ${name}` : name;
}

export function TimeZoneSettingsCard() {
  const { t } = useTranslation("account");
  const { t: tc } = useTranslation("common");
  const { preference, timeZone, setPreference } = useTimeZone();
  const [query, setQuery] = useState("");
  const detected = detectTimeZone();
  const zones = useMemo(() => listTimeZones().map((zone) => ({ zone, label: zoneLabel(zone) })), []);
  const now = new Intl.DateTimeFormat(intlLocale(), { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date());
  const visible = zones.filter(({ label }) => label.toLowerCase().includes(query.trim().toLowerCase()));
  const autoLabel = t("settings.timezone.auto", { timezone: zoneLabel(detected) });
  const selectedLabel = preference === AUTO_TIMEZONE ? autoLabel : zoneLabel(preference);

  function onChange(next: string) {
    setPreference(next).catch((error) => {
      console.error("[TimeZoneSettingsCard] failed to persist timezone:", error);
      toast.error(t("settings.timezone.saveFailed"));
    });
  }

  return (
    <SettingsRow
      title={t("settings.timezone.title")}
      description={
        <>
          {t("settings.timezone.description")}
          <br />
          {t("settings.timezone.current", { time: now })}
        </>
      }
      action={
        <div className="w-max min-w-[200px] max-w-full">
          <DropdownMenu onOpenChange={(open) => { if (!open) setQuery(""); }}>
            <DropdownMenuTriggerWithIndicator
              indicatorClassName="[&_svg]:size-5 [&_svg]:text-foreground"
              type="button"
              aria-label={`${t("settings.timezone.label")}: ${selectedLabel}`}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left text-body-large text-foreground"
            >
              <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
            </DropdownMenuTriggerWithIndicator>
            <DropdownMenuContent layout="multiple-list" align="end" className="w-max min-w-(--anchor-width) max-w-(--available-width)">
              <DropdownMenuSearch>
                <DropdownMenuSearchInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={tc("actions.search")}
                  aria-label={tc("actions.search")}
                />
              </DropdownMenuSearch>
              <DropdownMenuList>
                <DropdownMenuRadioGroup value={preference} onValueChange={(next) => onChange(String(next))}>
                  <DropdownMenuRadioItem size="large" value={AUTO_TIMEZONE}>
                    <DropdownMenuItemContent>{autoLabel}</DropdownMenuItemContent>
                  </DropdownMenuRadioItem>
                  {visible.map(({ zone, label }) => (
                    <DropdownMenuRadioItem key={zone} size="large" value={zone}>
                      <DropdownMenuItemContent>{label}</DropdownMenuItemContent>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuList>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  );
}
