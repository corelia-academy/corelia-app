import { useCallback } from "react";
import { useTranslation } from "react-i18next";
/** Learning editors address validation codes and stable artifact/test IDs dynamically. */
export function useLearningTranslation() {
  const { t: translate, i18n } = useTranslation("courses");
  const t = useCallback((key: string, options?: Record<string, unknown>) => String(translate(key as never, options as never)), [translate]);
  return { t, i18n };
}
