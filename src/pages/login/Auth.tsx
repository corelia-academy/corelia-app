import { Navigate, NavLink, useLocation } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/stores/authStore";
import { LoginForm } from "@/pages/login/LoginForm";

export default function Auth() {
  const { user, authInitialized } = useAuth();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  if (!authInitialized) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-auth-page">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden
        />
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <NavLink
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>Về trang chủ</span>
          </NavLink>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
