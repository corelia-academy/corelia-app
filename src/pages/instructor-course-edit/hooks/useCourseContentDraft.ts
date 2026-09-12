import { useCallback, useState, type SetStateAction } from "react";

type CourseContentDraft = {
  title: string;
  short_description: string;
  description: string;
  learning_outcomes: string[];
  final_assignment_title: string;
  final_assignment_description: string;
  final_assignment_instructions: string;
};

const emptyDraft: CourseContentDraft = {
  title: "", short_description: "", description: "", learning_outcomes: [],
  final_assignment_title: "", final_assignment_description: "", final_assignment_instructions: "",
};

/** In-memory authoring drafts, isolated by account/course/locale. */
export function useCourseContentDraft(selection: string) {
  type Entry = { value: CourseContentDraft; saved?: CourseContentDraft };
  const [drafts, setDrafts] = useState<Record<string, Entry>>({});
  const setContentForm = useCallback((action: SetStateAction<CourseContentDraft>) => {
    setDrafts(previous => ({ ...previous, [selection]: { ...previous[selection], value: typeof action === "function"
      ? action(previous[selection]?.value ?? emptyDraft) : action } }));
  }, [selection]);
  const hydrateContentForm = useCallback((content: CourseContentDraft) => {
    setDrafts(previous => previous[selection]?.saved ? previous : {
      ...previous, [selection]: { value: previous[selection]?.value ?? content, saved: content },
    });
  }, [selection]);
  const markContentSaved = useCallback((submitted: CourseContentDraft) => {
    // A save may resolve after another edit or locale switch. Acknowledge only
    // that request's snapshot, retaining any newer local changes.
    setDrafts(previous => ({ ...previous, [selection]: {
      value: previous[selection]?.value ?? submitted, saved: submitted,
    } }));
  }, [selection]);
  const scope = selection.slice(0, selection.lastIndexOf(":") + 1);
  const contentDirty = Object.entries(drafts).some(([key, entry]) => key.startsWith(scope)
    && JSON.stringify(entry.value) !== JSON.stringify(entry.saved ?? emptyDraft));
  return { contentForm: drafts[selection]?.value ?? emptyDraft, setContentForm, hydrateContentForm, markContentSaved, contentDirty };
}
