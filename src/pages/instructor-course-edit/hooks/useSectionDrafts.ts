import { useState } from "react";
import type { SupportedCourseLocale } from "@/types/courses";

export type SectionDraft = { title: string; description: string };
type Entry = { value: SectionDraft; saved: SectionDraft };
type Session = { token: object; locale: SupportedCourseLocale; entries: Partial<Record<SupportedCourseLocale, Entry>> };
const empty: SectionDraft = { title: "", description: "" };
const same = (a: SectionDraft, b: SectionDraft) => a.title === b.title && a.description === b.description;

/** Each dialog opening owns its responses; locale switches retain edited fields. */
export function useSectionDrafts() {
  const [session, setSession] = useState<Session | null>(null);
  const begin = (locale: SupportedCourseLocale, initial: Partial<Record<SupportedCourseLocale, SectionDraft>>) => {
    const token = {};
    const entries = Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, { value, saved: value }]));
    setSession({ token, locale, entries });
    return (target: SupportedCourseLocale, server: SectionDraft) => setSession(previous => {
      if (previous?.token !== token) return previous;
      const entry = previous.entries[target];
      const value = entry ? {
        title: entry.value.title === entry.saved.title ? server.title : entry.value.title,
        description: entry.value.description === entry.saved.description ? server.description : entry.value.description,
      } : server;
      return { ...previous, entries: { ...previous.entries, [target]: { value, saved: server } } };
    });
  };
  const setField = (field: keyof SectionDraft, value: string) => setSession(previous => {
    if (!session || previous?.token !== session.token) return previous;
    const entry = previous.entries[session.locale] ?? { value: empty, saved: empty };
    return { ...previous, entries: { ...previous.entries, [session.locale]: { ...entry, value: { ...entry.value, [field]: value } } } };
  });
  const select = (locale: SupportedCourseLocale) => setSession(previous => previous ? { ...previous, locale } : previous);
  const acknowledge = (locale: SupportedCourseLocale, submitted: SectionDraft) => setSession(previous => {
    if (!session || previous?.token !== session.token) return previous;
    const entry = previous.entries[locale];
    return entry ? { ...previous, entries: { ...previous.entries, [locale]: { ...entry, saved: submitted } } } : previous;
  });
  const changed = Object.entries(session?.entries ?? {}).filter(([, entry]) => !same(entry.value, entry.saved))
    .map(([locale, entry]) => [locale as SupportedCourseLocale, entry.value] as const);
  return { begin, select, acknowledge, close: () => setSession(null), changed, dirty: changed.length > 0,
    locale: session?.locale ?? "vi", value: session?.entries[session.locale]?.value ?? empty,
    get: (locale: SupportedCourseLocale) => session?.entries[locale]?.value,
    setTitle: (value: string) => setField("title", value), setDescription: (value: string) => setField("description", value) };
}
