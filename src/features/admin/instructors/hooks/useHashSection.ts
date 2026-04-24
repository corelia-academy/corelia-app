import { useEffect, useMemo, useState } from "react";

export function useHashSection<TSection extends string>({
  sectionIds,
  defaultSection,
}: {
  sectionIds: readonly TSection[];
  defaultSection: TSection;
}) {
  const ids = useMemo(() => sectionIds, [sectionIds]);
  const [activeSection, setActiveSection] = useState<TSection>(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    return (ids.includes(hash as TSection) ? hash : defaultSection) as TSection;
  });

  const setSection = (sectionId: TSection) => {
    setActiveSection(sectionId);
    window.location.hash = sectionId;
  };

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (ids.includes(hash as TSection)) {
        setActiveSection(hash as TSection);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [ids]);

  return { activeSection, setSection, setActiveSection };
}

