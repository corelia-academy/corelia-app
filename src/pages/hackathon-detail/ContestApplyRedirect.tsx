import { Navigate, useParams } from "react-router";

export default function ContestApplyRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/hackathons" replace />;
  return <Navigate to={`/hackathons/${id}/overview`} replace />;
}
