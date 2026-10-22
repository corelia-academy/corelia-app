/**
 * User display timezone preference.
 *
 * "auto" (the default) follows the browser's detected timezone. Any other value is
 * an IANA zone that becomes the default `timeZone` for every `Intl.DateTimeFormat`
 * and `Date#toLocale*String` call that does not pass its own `timeZone`; callers
 * that pin a zone explicitly (e.g. "UTC" calendars, Vietnam event times) keep it.
 */

export const AUTO_TIMEZONE = "auto";
export type TimeZonePreference = typeof AUTO_TIMEZONE | (string & {});

const STORAGE_KEY = "corelia.timezone";
const FALLBACK_TIMEZONE = "Asia/Ho_Chi_Minh";

const NativeDateTimeFormat = Intl.DateTimeFormat;
const nativeToLocaleString = Date.prototype.toLocaleString;
const nativeToLocaleDateString = Date.prototype.toLocaleDateString;
const nativeToLocaleTimeString = Date.prototype.toLocaleTimeString;

let preference: TimeZonePreference = AUTO_TIMEZONE;
let installed = false;
const listeners = new Set<() => void>();

export function detectTimeZone(): string {
  try {
    return new NativeDateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

export function isValidTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new NativeDateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseTimeZonePreference(value: string | null | undefined): TimeZonePreference {
  if (!value || value === AUTO_TIMEZONE) return AUTO_TIMEZONE;
  return isValidTimeZone(value) ? value : AUTO_TIMEZONE;
}

export function readTimeZonePreference(): TimeZonePreference {
  try {
    return parseTimeZonePreference(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return AUTO_TIMEZONE;
  }
}

function writeTimeZonePreference(value: TimeZonePreference): void {
  try {
    if (value === AUTO_TIMEZONE) globalThis.localStorage?.removeItem(STORAGE_KEY);
    else globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this session.
  }
}

export function getTimeZonePreference(): TimeZonePreference {
  return preference;
}

/** The IANA zone dates are currently displayed in. */
export function resolvedTimeZone(): string {
  return preference === AUTO_TIMEZONE ? detectTimeZone() : preference;
}

export function setTimeZonePreference(value: TimeZonePreference): void {
  const next = parseTimeZonePreference(value);
  writeTimeZonePreference(next);
  if (next === preference) return;
  preference = next;
  listeners.forEach((listener) => listener());
}

export function subscribeTimeZonePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function withPreferredTimeZone(options: Intl.DateTimeFormatOptions | undefined) {
  if (preference === AUTO_TIMEZONE || options?.timeZone) return options;
  return { ...options, timeZone: preference };
}

/** Applies the stored preference and makes it the default zone for date formatting. */
export function installTimeZonePreference(): void {
  preference = readTimeZonePreference();
  if (installed) return;
  installed = true;

  Intl.DateTimeFormat = new Proxy(NativeDateTimeFormat, {
    construct(target, [locales, options]) {
      return new target(locales, withPreferredTimeZone(options));
    },
    apply(target, _thisArg, [locales, options]) {
      return target(locales, withPreferredTimeZone(options));
    },
  });
  Date.prototype.toLocaleString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    return nativeToLocaleString.call(this, locales, withPreferredTimeZone(options));
  };
  Date.prototype.toLocaleDateString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    return nativeToLocaleDateString.call(this, locales, withPreferredTimeZone(options));
  };
  Date.prototype.toLocaleTimeString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    return nativeToLocaleTimeString.call(this, locales, withPreferredTimeZone(options));
  };
}

/** e.g. "GMT+7" for the zone at the given instant. */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new NativeDateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

export function listTimeZones(): string[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const detected = detectTimeZone();
  return zones.includes(detected) ? zones : [detected, ...zones];
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Calendar fields of an instant as seen in the given zone. */
export function wallClockInTimeZone(at: Date, timeZone: string): WallClock {
  const parts = new NativeDateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function timeZoneOffsetMs(at: number, timeZone: string): number {
  const w = wallClockInTimeZone(new Date(at), timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(at / 1000) * 1000;
}

/** The instant whose wall-clock time in `timeZone` matches the given fields. */
export function instantFromWallClock(wall: WallClock, timeZone: string): Date {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const first = guess - timeZoneOffsetMs(guess, timeZone);
  return new Date(guess - timeZoneOffsetMs(first, timeZone));
}

/** e.g. "Asia/Ho Chi Minh (GMT+7)". */
export function timeZoneDisplayLabel(timeZone: string = resolvedTimeZone()): string {
  const offset = timeZoneOffsetLabel(timeZone);
  const name = timeZone.replaceAll("_", " ");
  return offset ? `${name} (${offset})` : name;
}
