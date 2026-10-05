import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { useTranslation } from "react-i18next";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const illustrationTypes = [
  { value: "search", label: "Search No Data" },
  { value: "empty", label: "Empty No Data" },
] as const;

const illustrationSizes = [
  { value: "tiny", label: "Tiny · 120 px" },
  { value: "medium", label: "Medium · 200 px" },
  { value: "large", label: "Large · 280 px" },
] as const;

type AdminEmptyStateIllustrationComponentPageProps = {
  embedded?: boolean;
};

export default function AdminEmptyStateIllustrationComponentPage({
  embedded = false,
}: AdminEmptyStateIllustrationComponentPageProps) {
  const { t } = useTranslation("common");

  return (
    <ComponentShowcaseLayout
      title="Empty State Illustration"
      description="Inspect both illustration types at all three Figma sizes."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Types and sizes"
        criterion="Each sample uses the Figma artwork and its matching display size."
      >
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {illustrationTypes.flatMap(({ value: type, label: typeLabel }) =>
            illustrationSizes.map(({ value: size, label: sizeLabel }) => (
              <div
                key={`${type}-${size}`}
                data-testid={`empty-state-illustration-${type}-${size}`}
                className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border-subtle bg-surface-base p-4"
              >
                <p className="text-body-small text-foreground-muted">
                  {typeLabel} · {sizeLabel}
                </p>
                <EmptyStateIllustration
                  type={type}
                  size={size}
                  title={size === "tiny" ? undefined : t("projects.detail.notFoundTitle")}
                  description={t("projects.detail.notFoundDescription")}
                />
              </div>
            )),
          )}
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}
