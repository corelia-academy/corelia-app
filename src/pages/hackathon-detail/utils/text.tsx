export function renderTextAsList(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines.filter(
    (line) => line.startsWith("- ") || line.startsWith("• "),
  );
  if (bulletLines.length >= Math.max(3, Math.ceil(lines.length / 2))) {
    const items = lines
      .map((line) => line.replace(/^(-\s+|•\s+)/, "").trim())
      .filter(Boolean);
    return (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-foreground-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground-muted">
      {text}
    </p>
  );
}

