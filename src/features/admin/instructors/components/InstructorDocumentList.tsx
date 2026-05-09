import React from "react";
import type { PartnerProfileDocument } from "@/types/database";
import { intlLocale } from "@/lib/intl";

export function InstructorDocumentList({
  docs,
  emptyLabel,
  renderMeta,
}: {
  docs: PartnerProfileDocument[];
  emptyLabel: string;
  renderMeta: (doc: PartnerProfileDocument) => React.ReactNode;
}) {
  if (docs.length === 0) {
    return <p className="text-sm text-foreground-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {docs
        .slice()
        .reverse()
        .map((doc) => (
          <li
            key={doc.path}
            className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-base px-3 py-3"
          >
            <div className="min-w-0">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                title={doc.name}
              >
                {doc.name}
              </a>
              <div className="text-xs text-foreground-muted">{renderMeta(doc)}</div>
            </div>
            <span className="shrink-0 text-xs text-foreground-muted">
              {new Date(doc.uploaded_at).toLocaleDateString(intlLocale())}
            </span>
          </li>
        ))}
    </ul>
  );
}

