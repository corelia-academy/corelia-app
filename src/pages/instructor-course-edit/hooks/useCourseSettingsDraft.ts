import { useCallback, useState, type SetStateAction } from "react";

const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Preserve local settings edits while allowing server updates to untouched fields. */
export function useCourseSettingsDraft<T extends Record<string, unknown>>(scope: string, initial: T) {
  const [empty] = useState(initial);
  const [entries, setEntries] = useState<Record<string, { value: T; saved: T }>>({});
  const setValue = useCallback((action: SetStateAction<T>) => {
    setEntries(previous => {
      const entry = previous[scope] ?? { value: empty, saved: empty };
      return { ...previous, [scope]: { ...entry, value: typeof action === "function" ? action(entry.value) : action } };
    });
  }, [empty, scope]);
  const hydrate = useCallback((server: T) => {
    setEntries(previous => {
      const entry = previous[scope];
      if (!entry) return { ...previous, [scope]: { value: server, saved: server } };
      const value = Object.fromEntries(Object.keys(server).map(key => [key,
        equal(entry.value[key], entry.saved[key]) ? server[key] : entry.value[key],
      ])) as T;
      if (equal(value, entry.value) && equal(server, entry.saved)) return previous;
      return { ...previous, [scope]: { value, saved: server } };
    });
  }, [scope]);
  const acknowledge = useCallback((submitted: T) => {
    setEntries(previous => ({ ...previous, [scope]: { value: previous[scope]?.value ?? submitted, saved: submitted } }));
  }, [scope]);
  const entry = entries[scope];
  return { value: entry?.value ?? empty, setValue, hydrate, acknowledge, dirty: !!entry && !equal(entry.value, entry.saved) };
}
