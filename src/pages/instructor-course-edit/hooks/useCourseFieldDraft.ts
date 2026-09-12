import { useCallback, type SetStateAction } from "react";
import { useCourseSettingsDraft } from "./useCourseSettingsDraft";

/** Field adapter keeps the editor's existing setters and independent save flows. */
export function useCourseFieldDraft<T>(scope: string, initial: T) {
  const { value, setValue, hydrate, acknowledge, dirty } = useCourseSettingsDraft(scope, { field: initial });
  const setField = useCallback((action: SetStateAction<T>) => setValue(previous => ({
    field: typeof action === "function" ? (action as (previous: T) => T)(previous.field) : action,
  })), [setValue]);
  const hydrateField = useCallback((field: T) => hydrate({ field }), [hydrate]);
  const acknowledgeField = useCallback((field: T) => acknowledge({ field }), [acknowledge]);
  return [value.field, setField, hydrateField, acknowledgeField, dirty] as const;
}
