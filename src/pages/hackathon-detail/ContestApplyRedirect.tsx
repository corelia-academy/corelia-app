import { Navigate, useParams } from "react-router";

export default function ContestApplyRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/contests" replace />;
  return <Navigate to={`/contests/${id}/overview`} replace />;
}
