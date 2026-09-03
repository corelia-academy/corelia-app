import type { Job } from "@/types/jobs";

export function formatJobDescription(value: string | null | undefined): string {
  if (!value) return "";
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(
      /&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi,
      (entity, token: string) => {
        const normalized = token.toLowerCase();
        if (normalized === "nbsp") return " ";
        if (normalized === "amp") return "&";
        if (normalized === "lt") return "<";
        if (normalized === "gt") return ">";
        if (normalized === "quot") return '"';
        if (normalized === "apos") return "'";
        const codePoint = normalized.startsWith("#x")
          ? Number.parseInt(normalized.slice(2), 16)
          : Number.parseInt(normalized.slice(1), 10);
        try {
          return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : entity;
        } catch {
          return entity;
        }
      },
    );
    if (next === decoded) break;
    decoded = next;
  }
  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatJobSalary(job: Job, locale: string): string | null {
  if ((job.salary_min == null && job.salary_max == null) || !job.salary_currency) return null;
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: job.salary_currency,
      maximumFractionDigits: 0,
      notation: Math.max(job.salary_min ?? 0, job.salary_max ?? 0) >= 100_000 ? "compact" : "standard",
    });
    const min = job.salary_min == null ? null : formatter.format(job.salary_min);
    const max = job.salary_max == null ? null : formatter.format(job.salary_max);
    const range = min && max ? `${min}–${max}` : min ?? max;
    if (!range) return null;
    return job.salary_period ? `${range}/${job.salary_period}` : range;
  } catch {
    return null;
  }
}

export function formatJobDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) <= 30) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

export function humanizeJobSlug(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
