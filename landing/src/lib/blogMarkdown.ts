import { Marked, type Tokens } from "marked";

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Site paths, anchors, and http(s)/mailto/tel links only: no `javascript:` or `data:` URLs. */
function safeUrl(href: string): string | null {
  const value = href.trim();
  if (/^(?:\/(?!\/)|#|\.{1,2}\/)/.test(value)) return value;
  return /^(?:https?:|mailto:|tel:)/i.test(value) ? value : null;
}

const marked = new Marked({
  gfm: true,
  renderer: {
    // Articles are Markdown only; raw HTML typed into the editor is shown as text.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens);
      const url = safeUrl(href);
      if (!url) return label;
      const external = /^https?:/i.test(url) && !/^https?:\/\/(?:www\.)?corelia\.academy(?:[/?#]|$)/i.test(url);
      return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      const url = safeUrl(href);
      if (!url) return escapeHtml(text);
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" decoding="async" />`;
    },
  },
});

/** Article body (Markdown from Admin → Blog) to HTML for `set:html`. */
export function renderBlogMarkdown(body: string): string {
  return marked.parse(body, { async: false });
}
