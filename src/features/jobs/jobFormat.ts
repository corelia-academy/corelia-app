import type { Job } from "@/types/jobs";

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
