import { Navigate, useParams, useSearchParams } from "react-router";

/** Redirect `/hackathons/:slug/manage` → `.../manage/overview` (preserves query string). */
export function ContestManageIndexRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  if (!slug) return <Navigate to="/hackathons" replace />;
  const q = searchParams.toString();
  return (
    <Navigate
      to={`/hackathons/${slug}/manage/overview${q ? `?${q}` : ""}`}
      replace
    />
  );
}
