import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";

type FullPageEmptyStateProps = {
  title: string;
  description: string;
};

export function FullPageEmptyState({
  title,
  description,
}: FullPageEmptyStateProps) {
  return (
    <div className="full-page-empty-state container-app flex min-h-[calc(100svh-var(--app-header-height,0px))] items-center justify-center">
      <main className="flex w-full items-center justify-center">
        <EmptyStateIllustration
          type="empty"
          size="fullPage"
          title={title}
          description={description}
        />
      </main>
    </div>
  );
}
