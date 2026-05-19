import { Component, type ErrorInfo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Lightweight boundary for individual page sections — keeps other sections alive on error. */
export class SectionErrorBoundary extends Component<Props, State> {
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
          Không thể tải nội dung này.{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => this.setState({ error: null })}
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-destructive">Đã xảy ra lỗi</p>
          <p className="max-w-md text-sm text-foreground-muted">
            {this.state.error.message}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm transition-colors duration-150 hover:bg-surface-raised"
              onClick={() => this.setState({ error: null })}
            >
              Thử lại
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm transition-colors duration-150 hover:bg-surface-raised"
              onClick={() => {
                window.localStorage.removeItem("corelia-auth");
                window.location.href = "/";
              }}
            >
              Làm mới & về trang chủ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
