import {
  EmptyStateIllustration,
  type EmptyStateIllustrationSize,
  type EmptyStateIllustrationType,
} from "@/components/ui/empty-state-illustration";

type FullPageEmptyStateProps = {
  title: string;
  description: string;
  size?: EmptyStateIllustrationSize;
  type?: EmptyStateIllustrationType;
};

export function FullPageEmptyState({
  title,
  description,
  size = "fullPage",
  type = "empty",
}: FullPageEmptyStateProps) {
  return (
    <div className="full-page-empty-state container-app flex min-h-[calc(100svh-var(--app-header-height,0px))] items-center justify-center">
      <main className="flex w-full items-center justify-center">
        <EmptyStateIllustration
          type={type}
          size={size}
          title={title}
          description={description}
        />
      </main>
    </div>
  );
}
