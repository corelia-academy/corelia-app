import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/markdown/Markdown";

interface CourseDescriptionProps {
  description: string;
}

export function CourseDescription({ description }: CourseDescriptionProps) {
  const { t } = useTranslation("courses");
  if (!description?.trim()) return null;

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {String(t("detail.courseDetail.overview.title"))}
        </h2>
        <div className="mt-4">
          <Markdown content={description} />
        </div>
      </CardContent>
    </Card>
  );
}
