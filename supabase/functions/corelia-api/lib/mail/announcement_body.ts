function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** Strip any HTML to plain text (line breaks preserved). */
export function stripHtmlToPlainText(html: string): string {
  return decodeBasicEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*/gi, "\n\n")
      .replace(/<\/div>\s*/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

/** Safe announcement HTML: paragraphs + br only (no user-supplied tags). */
export function plainTextToAnnouncementHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  return normalized
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph.split("\n").map(escapeHtml).join("<br />");
      return `<p>${lines}</p>`;
    })
    .join("");
}

/** Normalize API input — strips pasted HTML and re-wraps as safe fragments. */
export function normalizeAnnouncementBodyHtml(html: string): string {
  return plainTextToAnnouncementHtml(stripHtmlToPlainText(html));
}
