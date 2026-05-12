export function getNextOrder(items: Array<{ order?: number | null }>): number {
  return items.reduce((max, item) => Math.max(max, Number(item.order ?? -1)), -1) + 1;
}

export function isValidHttpUrl(input?: string | null): boolean {
  const value = String(input ?? "").trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function createSponsorId(): string {
  try {
    return (
      String(globalThis.crypto?.randomUUID?.() ?? "").trim() || `${Date.now()}`
    );
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}
