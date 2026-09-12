import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { searchLearningInstructors } from "@/lib/learning";
import { getPublicProfileById } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import type { CourseInstructorRef } from "../types";
import { TextField, OrderedCard } from "./EditorFields";
import { moveItem } from "./order";
export function InstructorAttributionEditor({value,onChange}:{value:CourseInstructorRef[];onChange(value:CourseInstructorRef[]):void}){
  const {t}=useLearningTranslation();const [search,setSearch]=useState("");
  const query=useQuery({queryKey:["learning-people-search",search],queryFn:()=>searchLearningInstructors(search),staleTime:30_000});
  const profiles=useQuery({queryKey:["learning-attribution",value.map(v=>v.profile_id)],queryFn:()=>Promise.all(value.map(v=>getPublicProfileById(v.profile_id))),staleTime:30_000});
  return <div className="space-y-4"><p className="text-sm text-foreground-muted">{t("learning.attributionHint")}</p>{value.length===0&&<p>{t("learning.issuer")}</p>}{value.map((v,i)=><OrderedCard key={v.profile_id} index={i} total={value.length} onMove={d=>onChange(moveItem(value,i,d).map((item,order)=>({...item,order})))} onRemove={()=>onChange(value.filter((_,index)=>index!==i).map((item,order)=>({...item,order})))}><p>{profiles.data?.[i]?.full_name??v.profile_id}</p><TextField label={t("learning.roleLabel")} value={v.role_label??""} onChange={role_label=>onChange(value.map((item,index)=>index===i?{...item,role_label}:item))}/></OrderedCard>)}<TextField label={t("learning.search")} value={search} onChange={setSearch}/>{query.isError&&<div role="alert"><p>{t("learning.loadError")}</p><Button type="button" variant="outline" onClick={()=>void query.refetch()}>{t("learning.retry")}</Button></div>}<div className="max-h-72 space-y-2 overflow-y-auto">{query.data?.filter(p=>!value.some(v=>v.profile_id===p.id)).map(p=><div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"><span>{p.full_name}</span><Button type="button" variant="outline" onClick={()=>onChange([...value,{profile_id:p.id,order:value.length}])}>{t("learning.addInstructor")}</Button></div>)}</div></div>;
}
