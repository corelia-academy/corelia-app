import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/stores/authStore";
import { LoginForm } from "@/components/login/LoginForm";

export default function Auth() {
  const { user, authInitialized } = useAuth();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  if (!authInitialized) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-auth-page">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-auth-page p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>
    </div>
  );
}
