import { useEffect, useState, useRef } from "react";
import { useTranslations } from "@/i18n/translations";
import {
  LandingMobileSectionHeader,
  LandingTabPanelShell,
  LandingTabRow,
} from "@/components/landing/landing-tab-chrome";

type WhyKey = "Environment" | "Curriculum" | "Mentorship" | "Projects";

const Why = ({ lang = "vi" }: { lang?: "vi" | "en" }) => {
  const t = useTranslations(lang);
  const [why, setWhy] = useState<WhyKey>("Environment");
  const [isMobile, setIsMobile] = useState(false);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      cardsRef.current.forEach((card, index) => {
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const stackTop = windowHeight * 0.2;

        const progress = Math.min(Math.max((stackTop - rect.top) / 200, 0), 1);

        const scale = 1 - progress * (0.1 + index * 0.02);

        const translateY = progress > 0 ? index * 20 * progress : 0;

        card.style.transform = `translateY(${translateY}px) scale(${scale})`;
        card.style.transformOrigin = "top center";
        card.style.transition = "transform 0.1s ease-out";
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  const whyData: {
    key: WhyKey;
    title: string;
    description: string;
    tab: string;
  }[] = [
    {
      key: "Environment",
      title: t("why.environment.title"),
      description: t("why.environment.description"),
      tab: t("why.tab.environment"),
    },
    {
      key: "Curriculum",
      title: t("why.curriculum.title"),
      description: t("why.curriculum.description"),
      tab: t("why.tab.curriculum"),
    },
    {
      key: "Mentorship",
      title: t("why.mentorship.title"),
      description: t("why.mentorship.description"),
      tab: t("why.tab.mentorship"),
    },
    {
      key: "Projects",
      title: t("why.projects.title"),
      description: t("why.projects.description"),
      tab: t("why.tab.projects"),
    },
  ];

  const active = whyData.find((item) => item.key === why) ?? whyData[0];

  if (isMobile) {
    return (
      <div className="space-y-8 relative">
        {whyData.map((item, index) => (
          <div
            key={item.key}
            ref={(el) => {
              cardsRef.current[index] = el;
            }}
            className="sticky top-[20vh]"
            style={{ zIndex: index + 1 }}
          >
            <LandingMobileSectionHeader label={item.tab} />
            <LandingTabPanelShell variant="mobile">
              <div className="min-h-[350px] flex flex-col justify-center gap-4">
                <p className="text-xl font-medium">{item.title}</p>
                <p className="text-sm font-light">{item.description}</p>
              </div>
            </LandingTabPanelShell>
          </div>
        ))}
        <div className="h-[50vh]" />
      </div>
    );
  }

  return (
    <div className="h-min-content">
      <LandingTabRow
        columns={4}
        tabs={whyData.map((item) => ({ key: item.key, label: item.tab }))}
        activeKey={why}
        onSelect={(k) => setWhy(k as WhyKey)}
        ariaLabel={t("why.title")}
      />
      <LandingTabPanelShell variant="desktop">
        <div className="min-h-[512px] flex justify-between items-center gap-8">
          <div className="space-y-4 max-w-xl">
            <p className="text-3xl font-medium">{active.title}</p>
            <p className="text-base font-light">{active.description}</p>
          </div>
        </div>
      </LandingTabPanelShell>
    </div>
  );
};

export default Why;
