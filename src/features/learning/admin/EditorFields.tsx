import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
export const inputClass = "min-h-11 w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";
export function TextField({ label, value, onChange, multiline = false, type = "text", id, disabled = false }: { label: string; value: string; onChange(value: string): void; multiline?: boolean; type?: string; id?: string; disabled?: boolean }) {
  const generated = useId(); const fieldId = id ?? generated;
  return <div className="space-y-1.5"><label htmlFor={fieldId} className="block text-sm font-medium">{label}</label>{multiline ? <textarea id={fieldId} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} rows={5} className={inputClass} /> : <input id={fieldId} disabled={disabled} type={type} value={value} onChange={e => onChange(e.target.value)} className={inputClass} />}</div>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) { return <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>; }
export function OrderedCard({ children, index, total, onMove, onRemove }: { children: ReactNode; index: number; total: number; onMove(direction: -1|1): void; onRemove(): void }) {
  const { t } = useLearningTranslation();
  return <div className="space-y-3 rounded-xl border border-border p-4">{children}<div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" disabled={index===0} onClick={() => onMove(-1)}>{t("learning.moveUp")}</Button><Button type="button" variant="ghost" disabled={index===total-1} onClick={() => onMove(1)}>{t("learning.moveDown")}</Button><Button type="button" variant="ghost" onClick={onRemove}>{t("learning.remove")}</Button></div></div>;
}
