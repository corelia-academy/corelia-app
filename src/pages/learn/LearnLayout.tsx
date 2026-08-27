import { Outlet } from "react-router";

export default function LearnLayout() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
