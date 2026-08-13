import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

interface CourseSkillsProps {
  skills: string[];
}

export function CourseSkills({ skills }: CourseSkillsProps) {
  const { t } = useTranslation("courses");
  const items = Array.from(
    new Map(
      skills
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [item.toLocaleLowerCase(), item] as const),
    ).values(),
  );
  if (items.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h2 className="text-[18px] font-semibold text-foreground">
          {String(t("detail.courseDetail.skills.title"))}
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {String(t("detail.courseDetail.skills.subtitle"))}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
            >
              {item}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
