export type FillSegment = { type: "source"; value: string } | { type: "blank"; id: string };
export function parseMarkers(source: string): FillSegment[] {
  const segments: FillSegment[] = [];
  const ids = new Set<string>();
  let end = 0;
  for (const match of source.matchAll(/\{\{blank:([a-z][a-z0-9_]{0,31})\}\}/g)) {
    const value = source.slice(end, match.index);
    if (value.includes("{{") || value.includes("}}")) throw new Error("malformed_marker");
    if (ids.has(match[1])) throw new Error("duplicate_marker");
    ids.add(match[1]);
    segments.push({ type: "source", value }, { type: "blank", id: match[1] });
    end = match.index! + match[0].length;
  }
  const tail = source.slice(end);
  if (tail.includes("{{") || tail.includes("}}")) throw new Error("malformed_marker");
  segments.push({ type: "source", value: tail });
  return segments;
}
export function reconstructSource(source: string, answers: Record<string, string>): string {
  return parseMarkers(source).map(s => s.type === "source" ? s.value : answers[s.id] ?? "").join("");
}
