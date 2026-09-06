export function formatPrizeAmount(amount: string, locale: string): string {
  const value = Number(amount);
  return Number.isFinite(value)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value)
    : amount;
}
