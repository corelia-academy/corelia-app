import { intlLocale } from "@/lib/intl";

export function normalizeVndDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function formatVndInput(value: string): string {
  return value ? Number(value).toLocaleString(intlLocale()) : "";
}
