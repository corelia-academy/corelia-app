import { Navigate, useLocation, useParams } from "react-router";
import NotFound from "@/pages/NotFound";

const RESERVED_HANDLES = new Set([
  "login",
  "ocid-redirect",
  "account",
  "admin",
  "instructor",
  "courses",
  "cohorts",
  "learn",
  "roadmap",
  "contests",
  "achievements",
]);

export default function UserHandleRedirect() {
  const params = useParams<{ handle: string; "*": string }>();
  const location = useLocation();

  const handle = (params.handle ?? "").trim();
  if (!handle) return <NotFound />;
  if (RESERVED_HANDLES.has(handle.toLowerCase())) return <NotFound />;

  const rest = (params["*"] ?? "").replace(/^\/+/, "");
  const next = rest ? `/u/${encodeURIComponent(handle)}/${rest}` : `/u/${encodeURIComponent(handle)}`;

  // Preserve query string (e.g. utm params) if present.
  const search = location.search || "";
  return <Navigate to={`${next}${search}`} replace />;
}

