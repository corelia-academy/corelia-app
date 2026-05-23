/** Escape text for safe inclusion in email HTML fragments. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert instructor plain text to email-safe HTML (paragraphs + line breaks only).
 * Never exposes raw HTML editing in the UI.
 */
export function plainTextToAnnouncementHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  return normalized
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br />");
      return `<p>${lines}</p>`;
    })
    .join("");
}
