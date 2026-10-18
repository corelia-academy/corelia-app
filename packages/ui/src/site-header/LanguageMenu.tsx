import { useEffect, useId, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";

import { SITE_LOCALES, SITE_LOCALE_META, type SiteLocale } from "../locales";

export type LanguageMenuProps = {
  locale: SiteLocale;
  /** Defaults to every site locale. */
  locales?: readonly SiteLocale[];
  label: string;
  onSelect: (locale: SiteLocale) => void;
};

/** Globe button with a popover listing languages by their native names. */
export function LanguageMenu({ locale, locales = SITE_LOCALES, label, onSelect }: LanguageMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="csh-lang">
      <button
        type="button"
        className="csh-icon-button"
        aria-label={`${label}: ${SITE_LOCALE_META[locale].endonym}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe aria-hidden size={20} />
      </button>
      <ul id={listId} className="csh-lang-list" hidden={!open} aria-label={label}>
        {locales.map((item) => (
          <li key={item}>
            <button
              type="button"
              className="csh-lang-option"
              lang={SITE_LOCALE_META[item].hreflang}
              aria-current={item === locale ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                if (item !== locale) onSelect(item);
              }}
            >
              <span>{SITE_LOCALE_META[item].endonym}</span>
              {item === locale ? <Check aria-hidden size={16} /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
