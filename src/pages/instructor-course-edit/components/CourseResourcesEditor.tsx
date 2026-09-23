import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CourseResource } from "@/types/courses";

export function CourseResourcesEditor({ value, onChange, disabled }: {
  value: CourseResource[];
  onChange: (value: CourseResource[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("courses");
  const move = (index: number, offset: number) => {
    const next = [...value];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <fieldset disabled={disabled} className="min-w-0 rounded-xl border border-border-subtle p-4">
      <legend className="px-1 font-medium">{t("courseResources.title")}</legend>
      <p className="mb-4 text-sm text-foreground-muted">{t("courseResources.editorHint")}</p>
      <div className="space-y-3">
        {value.map((resource, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border border-border-subtle p-3">
            <label className="min-w-0 flex-[1_1_180px] space-y-1 text-sm">
              <span>{t("courseResources.name", { count: index + 1 })}</span>
              <Input value={resource.title} onChange={event => onChange(value.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} />
            </label>
            <label className="min-w-0 flex-[2_1_240px] space-y-1 text-sm">
              <span>{t("courseResources.url", { count: index + 1 })}</span>
              <Input type="url" value={resource.url} placeholder="https://" onChange={event => onChange(value.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} />
            </label>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="icon" disabled={index === 0} aria-label={t("courseResources.moveUp", { count: index + 1 })} onClick={() => move(index, -1)}><ArrowUp className="size-4" aria-hidden /></Button>
              <Button type="button" variant="outline" size="icon" disabled={index === value.length - 1} aria-label={t("courseResources.moveDown", { count: index + 1 })} onClick={() => move(index, 1)}><ArrowDown className="size-4" aria-hidden /></Button>
              <Button type="button" variant="outline" size="icon" aria-label={t("courseResources.remove", { count: index + 1 })} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 className="size-4" aria-hidden /></Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" className="mt-3" onClick={() => onChange([...value, { title: "", url: "" }])}><Plus className="size-4" aria-hidden />{t("courseResources.add")}</Button>
    </fieldset>
  );
}
