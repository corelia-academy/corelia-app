import { PracticeProjectField } from "../PracticeProject";
import { PracticeHackathonField } from "../PracticeHackathon";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { ARTIFACT_FIELDS, type PracticeConfig } from "../types";
import { TextField, Toggle, OrderedCard, inputClass } from "./EditorFields";
import { moveItem } from "./order";
import { useLearningConfirm } from "../useLearningConfirm";
export function PracticeBuilder({ config, onChange }: { config: PracticeConfig; onChange(config: PracticeConfig): void }) {
  const { t } = useLearningTranslation();
  const { confirm, confirmation } = useLearningConfirm();
  const patch = (p: Partial<PracticeConfig>) => onChange({ ...config,...p });
  const steps = config.project_steps ?? [];
  const items = config.checklist_items ?? [];
  const artifactMode = ["submission", "guided_project"].includes(config.mode);
  const changeMode = async (mode: PracticeConfig["mode"]) => {
    if (mode === config.mode) return;
    const keepArtifacts = ["submission", "guided_project"].includes(mode);
    const removesData = (mode !== "checklist" && items.length > 0)
      || (mode !== "guided_project" && steps.length > 0)
      || (!keepArtifacts && (config.submission_fields?.length ?? 0) > 0);
    if (removesData && !await confirm(t("learning.changePracticeModeConfirm"))) return;
    patch({ mode, checklist_items: mode === "checklist" ? items : [],
      project_steps: mode === "guided_project" ? steps : [],
      submission_fields: keepArtifacts ? config.submission_fields : [] });
  };
  return <div id="learning-practice_config" tabIndex={-1} className="space-y-4">{confirmation}<label className="block text-sm">{t("learning.mode")}<select value={config.mode} className={inputClass} onChange={e => void changeMode(e.target.value as PracticeConfig["mode"])}>{["instruction","checklist","submission","guided_project"].map(m => <option key={m} value={m}>{t(`learning.${m}`)}</option>)}</select></label>
    {config.mode === "checklist" && <>{items.map((item,i) => <OrderedCard key={item.id} index={i} total={items.length} onMove={d => patch({ checklist_items:moveItem(items,i,d) })} onRemove={() => patch({ checklist_items:items.filter((_,j)=>j!==i) })}><TextField id={`learning-practice-checklist-${i}`} label={t("learning.title")} value={item.label} onChange={label => patch({ checklist_items:items.map((v,j)=>j===i?{ ...v,label }:v) })} /></OrderedCard>)}<Button type="button" id="learning-practice-add-item" variant="outline" onClick={() => patch({ checklist_items:[...items,{ id:crypto.randomUUID(),label:"" }] })}>{t("learning.addItem")}</Button></>}
    {config.mode === "guided_project" && <>{steps.map((step,i) => <OrderedCard key={step.id} index={i} total={steps.length} onMove={d => patch({ project_steps:moveItem(steps,i,d).map((s,order)=>({ ...s,order })) })} onRemove={() => patch({ project_steps:steps.filter((_,j)=>j!==i) })}><TextField id={`learning-practice-step-${i}`} label={t("learning.title")} value={step.title} onChange={title => patch({ project_steps:steps.map((s,j)=>j===i?{ ...s,title }:s) })} /><TextField label={t("learning.instructions")} multiline value={step.instructions_markdown ?? ""} onChange={instructions_markdown => patch({ project_steps:steps.map((s,j)=>j===i?{ ...s,instructions_markdown }:s) })} /><Toggle label={t("learning.artifactRequired")} checked={step.verification === "artifact_required"} onChange={checked => patch({ project_steps:steps.map((s,j)=>j===i?{ ...s,verification:checked?"artifact_required":"self_check" }:s) })} />{step.verification === "artifact_required" && <div id={`learning-practice-step-artifacts-${i}`} tabIndex={-1}>{ARTIFACT_FIELDS.map(f => <Toggle key={f} label={t(`learning.artifacts.${f}`)} checked={step.artifact_fields?.includes(f) ?? false} onChange={checked => patch({ submission_fields:Array.from(new Set([...config.submission_fields ?? [],...(checked?[f]:[])])),project_steps:steps.map((s,j)=>j===i?{ ...s,artifact_fields:checked?[...s.artifact_fields ?? [],f]:(s.artifact_fields ?? []).filter(x=>x!==f) }:s) })} />)}</div>}</OrderedCard>)}<Button type="button" id="learning-practice-add-item" variant="outline" onClick={() => patch({ project_steps:[...steps,{ id:crypto.randomUUID(),title:"",order:steps.length,verification:"self_check" }] })}>{t("learning.addItem")}</Button></>}
    {(artifactMode || (config.submission_fields?.length ?? 0) > 0) && <fieldset id="learning-practice-submission-fields" tabIndex={-1}><legend>{t("learning.requiredArtifacts")}</legend>{!artifactMode && <p role="alert">{t("learning.legacyPracticeArtifacts")}</p>}{ARTIFACT_FIELDS.map(f => <Toggle key={f} label={t(`learning.artifacts.${f}`)} checked={config.submission_fields?.includes(f) ?? false} onChange={checked => patch({ submission_fields:checked?[...config.submission_fields ?? [],f]:(config.submission_fields ?? []).filter(x=>x!==f) })} />)}<p className="text-sm text-foreground-muted">{t("learning.reviewCourseOnly")}</p></fieldset>}
    <PracticeProjectField value={config.related_project_id} onChange={related_project_id => patch({ related_project_id })} />
    {config.related_project_template_id && <div role="alert"><p>{t("learning.legacyProjectTemplate")}</p><Button type="button" variant="outline" onClick={() => patch({ related_project_template_id: undefined })}>{t("learning.removeLegacyProjectTemplate")}</Button></div>}
    <PracticeHackathonField value={config.related_hackathon_id} onChange={related_hackathon_id => patch({ related_hackathon_id })} />
  </div>;
}
