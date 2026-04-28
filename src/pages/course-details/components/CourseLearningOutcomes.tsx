import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

interface CourseLearningOutcomesProps {
  outcomes: string[];
}

export function CourseLearningOutcomes({
  outcomes,
}: CourseLearningOutcomesProps) {
  const { t } = useTranslation("courses");
  const items = outcomes.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {String(t("detail.courseDetail.learningOutcomes.title"))}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {String(t("detail.courseDetail.learningOutcomes.subtitle"))}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {items.map((item, idx) => (
            <li key={`${idx}-${item}`} className="flex items-start gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/50" />
              <span className="leading-7">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
