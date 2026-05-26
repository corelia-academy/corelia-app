import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/markdown/Markdown";

interface CourseDescriptionProps {
  description: string;
  isExternalAggregated?: boolean;
  externalSourceUrls?: string[];
  externalSourceAttributionNote?: string | null;
}

export function CourseDescription({
  description,
  isExternalAggregated,
  externalSourceUrls,
  externalSourceAttributionNote,
}: CourseDescriptionProps) {
  const { t } = useTranslation("courses");
  const links = (externalSourceUrls ?? []).map((x) => x.trim()).filter(Boolean);
  const note = (externalSourceAttributionNote ?? "").trim();
  const shouldShowAttribution = Boolean(isExternalAggregated) && (links.length > 0 || note);
  if (!description?.trim() && !shouldShowAttribution) return null;

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h2 className="text-[18px] font-semibold text-foreground">
          {String(t("detail.courseDetail.overview.title"))}
        </h2>
        {description?.trim() ? (
          <div className="mt-4">
            <Markdown content={description} />
          </div>
        ) : null}
        {shouldShowAttribution ? (
          <div className="mt-5 rounded-md border border-border-subtle bg-surface-raised p-4">
            <p className="text-sm font-medium text-foreground">Sources & Attribution</p>
            {note ? <p className="mt-1 text-sm text-foreground-muted">{note}</p> : null}
            {links.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {links.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
