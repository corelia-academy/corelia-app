import { Navigate, useParams } from "react-router";

const LEGACY_TAB_TO_FRAGMENT: Record<
  "overview" | "timeline" | "prizes" | "partners" | "rules" | "faqs" | "projects",
  string
> = {
  overview: "about",
  timeline: "timeline",
  prizes: "prizes",
  partners: "partners",
  rules: "rules",
  faqs: "faq",
  projects: "projects",
};

export function ContestPublicLegacyRedirect({
  tab,
}: {
  tab: keyof typeof LEGACY_TAB_TO_FRAGMENT;
}) {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/hackathons" replace />;
  const fragment = LEGACY_TAB_TO_FRAGMENT[tab];
  return <Navigate to={`/hackathons/${slug}#${fragment}`} replace />;
}
