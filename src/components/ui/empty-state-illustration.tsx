import { cn } from "@/lib/utils";
import emptyNoDataSvg from "@/assets/illustrations/empty-state/empty-no-data.svg?raw";
import searchNoDataSvg from "@/assets/illustrations/empty-state/search-no-data.svg?raw";

export type EmptyStateIllustrationType = "search" | "empty";
export type EmptyStateIllustrationSize = "tiny" | "medium" | "large" | "fullPage";

type EmptyStateIllustrationProps = {
  type: EmptyStateIllustrationType;
  size: EmptyStateIllustrationSize;
  title?: string;
  description?: string;
};

const illustrationMarkup: Record<EmptyStateIllustrationType, string> = {
  search: searchNoDataSvg,
  empty: emptyNoDataSvg,
};

const illustrationSizes: Record<EmptyStateIllustrationSize, string> = {
  tiny: "size-[120px]",
  medium: "size-[200px]",
  large: "size-[280px]",
  fullPage: "size-[240px]",
};

const illustrationInsets: Record<EmptyStateIllustrationType, string> = {
  search: "inset-0",
  empty: "inset-[13.75%_10.8%_17.27%_10.3%]",
};

const contentWidths: Record<EmptyStateIllustrationSize, string> = {
  tiny: "w-[240px]",
  medium: "w-[240px]",
  large: "w-[320px]",
  fullPage: "w-[320px]",
};

const titleStyles: Partial<Record<EmptyStateIllustrationSize, string>> = {
  medium: "text-heading-medium font-display",
  large: "text-heading-large font-display",
  fullPage: "text-heading-large font-display",
};

const descriptionStyles: Record<EmptyStateIllustrationSize, string> = {
  tiny: "text-sm leading-[1.4] tracking-[0.02em]",
  medium: "text-sm leading-[1.4] tracking-[0.02em]",
  large: "text-base leading-[1.4] tracking-[0.02em]",
  fullPage: "text-base leading-[1.4] tracking-[0.02em]",
};

export function EmptyStateIllustration({
  type,
  size,
  title,
  description,
}: EmptyStateIllustrationProps) {
  return (
    <div
      data-slot="empty-state-illustration"
      className="flex shrink-0 flex-col items-center gap-3 text-center"
    >
      <div
        className={cn(
          "relative shrink-0 select-none",
          illustrationSizes[size],
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "absolute [&_svg]:block [&_svg]:max-w-none [&_svg]:size-full",
            illustrationInsets[type],
          )}
          dangerouslySetInnerHTML={{ __html: illustrationMarkup[type] }}
        />
      </div>
      {(description || (size !== "tiny" && title)) && (
        <div
          className={cn(
            "flex flex-col items-center gap-2 text-foreground-muted",
            contentWidths[size],
          )}
        >
          {size !== "tiny" && title ? (
            <p className={titleStyles[size]}>{title}</p>
          ) : null}
          {description ? (
            <p className={cn("font-body", descriptionStyles[size])}>
              {description}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
