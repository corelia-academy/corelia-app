export function parseLineList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

