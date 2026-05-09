import { Navigate, useParams } from "react-router";

export default function ContestApplyRedirect() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/hackathons" replace />;
  return <Navigate to={`/hackathons/${slug}/overview`} replace />;
}
