import { lazy, Suspense } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import NotFound from "@/pages/NotFound";

// Public profile layout is rendered directly at /@handle (canonical URL).
const UserProfileLayout = lazy(() => import("@/pages/users/user-profile"));

const RESERVED_HANDLES = new Set([
  "login",
  "ocid-redirect",
  "account",
  "admin",
  "instructor",
  "feed",
  "courses",
  "cohorts",
  "learn",
  "roadmap",
  "career",
  "contests",
  "hackathons",
  "projects",
  "search",
  "checkout",
  "invites",
  "email",
  "auth",
  "upgrade",
  "achievements",
  "u",
  "claim",
  "cora",
]);

/**
 * Top-level handle route. Canonical public profiles live at `/@handle`.
 * - `/@handle`  → render the profile (the `handle` param keeps its leading `@`,
 *   which the profile lookup strips).
 * - `/handle`   → redirect to the canonical `/@handle` (back-compat / vanity).
 * - reserved    → NotFound.
 */
export default function UserHandleRedirect() {
  const params = useParams<{ handle: string; "*": string }>();
  const location = useLocation();

  const raw = (params.handle ?? "").trim();
  if (!raw) return <NotFound />;

  const hasAt = raw.startsWith("@");
  const handle = (hasAt ? raw.slice(1) : raw).trim();
  if (!handle || RESERVED_HANDLES.has(handle.toLowerCase())) return <NotFound />;

  if (hasAt) {
    return (
      <Suspense fallback={null}>
        <UserProfileLayout />
      </Suspense>
    );
  }

  // Bare handle → canonicalize to /@handle, preserving any subpath + query.
  const rest = (params["*"] ?? "").replace(/^\/+/, "");
  const next = rest ? `/@${handle}/${rest}` : `/@${handle}`;
  return <Navigate to={`${next}${location.search || ""}`} replace />;
}
