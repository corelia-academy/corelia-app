import { useLearningConfirm } from "@/features/learning/useLearningConfirm";
import { useRef, useState } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { moveItem } from "@/features/learning/admin/order";
import { TextField, Toggle, OrderedCard, inputClass } from "@/features/learning/admin/EditorFields";
import { CodeEditor } from "../CodeEditor";
import { defaultCodeConfig, validateCodeConfig } from "../config";
import { parseMarkers } from "../markers";
import { evaluateCodeExercise } from "../evaluate";
import type { CodeExerciseConfig, CodeExerciseTest } from "../types";

export function CodeExerciseBuilder({ config, onChange }: { config: CodeExerciseConfig; onChange(config: CodeExerciseConfig): void }) {
  const { t } = useLearningTranslation();
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const patch = (value: Partial<CodeExerciseConfig>) => onChange({ ...config, ...value } as CodeExerciseConfig);
  function changeSource(source: string) {
    if (config.mode === "edit") { patch({ file: { ...config.file, starter_source: source } }); return; }
    try {
      const ids = parseMarkers(source).flatMap(s => s.type === "blank" ? [s.id] : []);
      patch({ file: { ...config.file, starter_source: source }, blanks: ids.map(id => config.blanks.find(b => b.id === id) ?? { id, accepted_answers: [""] }) });
    } catch { patch({ file: { ...config.file, starter_source: source } }); }
  }
  function makeBlank() {
    const textarea = sourceRef.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd || config.mode !== "fill") return;
    const source = config.file.starter_source;
    const answer = source.slice(textarea.selectionStart,textarea.selectionEnd);
    if (/[\r\n]/.test(answer)) return;
    const id = `blank_${config.blanks.length+1}`;
    onChange({ ...config, file: { ...config.file, starter_source: source.slice(0,textarea.selectionStart)+`{{blank:${id}}}`+source.slice(textarea.selectionEnd) }, blanks: [...config.blanks,{ id, accepted_answers:[answer] }] });
  }
  function setTest(index: number, next: CodeExerciseTest) { patch({ tests: (config.tests ?? []).map((test,i) => i===index ? next : test) }); }
  const { confirm, confirmation } = useLearningConfirm();
  return <div id="learning-code_exercise_config" tabIndex={-1} className="space-y-5">
    {confirmation}<p className="rounded-xl bg-surface-raised p-4 text-sm">{t("learning.textRulesNotice")}</p>
    <label className="block text-sm">{t("learning.mode")}<select className={inputClass} value={config.mode} onChange={async e => { const mode = e.target.value as "fill"|"edit"; if (await confirm(t("learning.dirtyConfirm"))) onChange(defaultCodeConfig(mode)); }}><option value="fill">{t("learning.fill")}</option><option value="edit">{t("learning.editCode")}</option></select></label>
    <TextField id="learning-code-file" label={t("learning.fileName")} value={config.file.path} onChange={path => patch({ file: { ...config.file,path } })} />
    <div id="learning-code-starter" tabIndex={-1} className="space-y-2"><p className="text-sm font-medium">{t("learning.starter")}</p>{config.mode === "fill" ? <><textarea aria-label={t("learning.starter")} ref={sourceRef} value={config.file.starter_source} onChange={e => changeSource(e.target.value)} className={`${inputClass} min-h-48 font-mono`} /><Button type="button" variant="outline" onClick={makeBlank}>{t("learning.makeBlank")}</Button></> : <CodeEditor source={config.file.starter_source} onChange={changeSource} />}</div>
    {config.mode === "fill" && config.blanks.map((blank,index) => <div key={blank.id} className="space-y-3 rounded-xl border border-border p-4"><p className="font-mono text-sm">{blank.id}</p><TextField id={`learning-code-blank-${index}`} label={t("learning.acceptedAnswers")} multiline value={blank.accepted_answers.join("\n")} onChange={value => patch({ blanks: config.blanks.map((b,i) => i===index ? { ...b,accepted_answers:value.split("\n") } : b) })} /><Toggle label={t("learning.caseSensitive")} checked={blank.case_sensitive !== false} onChange={value => patch({ blanks: config.blanks.map((b,i) => i===index ? { ...b,case_sensitive:value } : b) })} /><Toggle label={t("learning.trimWhitespace")} checked={blank.trim_whitespace !== false} onChange={value => patch({ blanks: config.blanks.map((b,i) => i===index ? { ...b,trim_whitespace:value } : b) })} /><TextField label={t("learning.feedback")} value={blank.feedback ?? ""} onChange={value => patch({ blanks: config.blanks.map((b,i) => i===index ? { ...b,feedback:value } : b) })} /></div>)}
    {(config.tests ?? []).map((test,index) => <OrderedCard key={test.id} index={index} total={config.tests!.length} onMove={direction => patch({ tests: moveItem(config.tests!,index,direction) })} onRemove={() => patch({ tests: config.tests!.filter((_,i)=>i!==index) })}>
      <TextField id={`learning-code-test-${index}`} label={t("learning.description")} value={test.description} onChange={description => setTest(index,{ ...test,description })} />
      <label className="block text-sm">{t("learning.testType")}<select className={inputClass} value={test.type} onChange={e => setTest(index,e.target.value === "source_equals" ? { id:test.id,description:test.description,required:test.required,type:"source_equals",accepted_sources:[config.reference_solution] } : { id:test.id,description:test.description,required:test.required,type:e.target.value as "contains"|"not_contains",value:"" })}><option value="source_equals">source_equals</option><option value="contains">contains</option><option value="not_contains">not_contains</option></select></label>
      {test.type === "source_equals" ? <>{test.accepted_sources.map((value,sourceIndex) => <TextField id={`learning-code-test-${index}-source-${sourceIndex}`} key={sourceIndex} label={`${t("learning.testValue")} ${sourceIndex+1}`} multiline value={value} onChange={v => setTest(index,{ ...test,accepted_sources:test.accepted_sources.map((s,i)=>i===sourceIndex?v:s) })} />)}<Button id={`learning-code-test-${index}-add-source`} type="button" variant="outline" onClick={() => setTest(index,{ ...test,accepted_sources:[...test.accepted_sources,""] })}>{t("learning.addItem")}</Button></> : <TextField id={`learning-code-test-${index}-value`} label={t("learning.testValue")} multiline value={test.value} onChange={value => setTest(index,{ ...test,value })} />}
      <Toggle label={t("learning.required")} checked={test.required} onChange={required => setTest(index,{ ...test,required })} /><TextField label={t("learning.feedback")} value={test.failure_message ?? ""} onChange={failure_message => setTest(index,{ ...test,failure_message })} /><TextField label={t("learning.hints")} value={test.hint ?? ""} onChange={hint => setTest(index,{ ...test,hint })} />
    </OrderedCard>)}
    <Button id="learning-code-add-test" type="button" variant="outline" onClick={() => patch({ tests:[...config.tests ?? [],{ id:crypto.randomUUID(),type:"contains",description:"",value:"",required:true }] })}>{t("learning.addTest")}</Button>
    <TextField id="learning-code-reference" label={t("learning.referenceSolution")} multiline value={config.reference_solution} onChange={reference_solution => patch({ reference_solution })} />
    <TextField id="learning-code-hints" label={t("learning.hints")} multiline value={(config.hints ?? []).join("\n")} onChange={value => patch({ hints:value.split("\n") })} />
    <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setMessages(validateCodeConfig(config,true))}>{t("learning.validateSolution")}</Button><Button type="button" variant="outline" onClick={() => { try { setMessages([evaluateCodeExercise(config,{ source:config.file.starter_source,answers:{} }).passed ? "passed" : "failed"]); } catch { setMessages(["invalid_config"]); } }}>{t("learning.runStarter")}</Button></div>
    <div aria-live="polite">{messages.length ? messages.map((message,i) => <p key={i}>{t(`learning.validation.${message}`, { defaultValue:message })}</p>) : <p>{t("learning.ready")}</p>}</div>
  </div>;
}
