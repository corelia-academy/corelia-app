import { Navigate, useLocation } from "react-router";

/** `/learn/*` was the lesson player before the app moved under the `/learn` base path; keep old links working. */
export default function LegacyLearnRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={{ pathname: pathname.replace(/^\/learn(?=\/|$)/, "/study"), search, hash }} replace />;
}
