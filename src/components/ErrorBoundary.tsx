import { Component, type ErrorInfo, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { isStaleChunkLoadError } from "@/lib/staleChunkRecovery";

interface Props {
  children: ReactNode;
}

interface BoundaryProps extends Props {
  t: TFunction;
}

interface State {
  error: Error | null;
}

/** Lightweight boundary for individual page sections — keeps other sections alive on error. */
class SectionErrorBoundaryInner extends Component<BoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SectionErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className={cn(
            "rounded-lg border border-border-subtle bg-surface-raised px-4 py-3",
            "text-sm text-foreground-muted",
          )}
          role="alert"
        >
          {this.props.t("errorBoundary.sectionMessage")}{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => this.setState({ error: null })}
          >
            {this.props.t("actions.retry")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SectionErrorBoundary({ children }: Props) {
  const { t } = useTranslation("common");
  return <SectionErrorBoundaryInner t={t}>{children}</SectionErrorBoundaryInner>;
}

class ErrorBoundaryInner extends Component<BoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    if (this.state.error && isStaleChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }

    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const isStaleChunk = isStaleChunkLoadError(this.state.error);

      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-destructive">
            {this.props.t(isStaleChunk ? "errorBoundary.staleTitle" : "errorBoundary.title")}
          </p>
          <p className="max-w-md text-sm text-foreground-muted">
            {isStaleChunk
              ? this.props.t("errorBoundary.staleMessage")
              : this.state.error.message}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm transition-colors duration-150 hover:bg-surface-raised"
              onClick={this.handleRetry}
            >
              {this.props.t(isStaleChunk ? "errorBoundary.reload" : "actions.retry")}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm transition-colors duration-150 hover:bg-surface-raised"
              onClick={() => {
                window.location.assign("/");
              }}
            >
              {this.props.t("errorBoundary.goHome")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({ children }: Props) {
  const { t } = useTranslation("common");
  return <ErrorBoundaryInner t={t}>{children}</ErrorBoundaryInner>;
}
