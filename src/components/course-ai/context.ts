export type AssistantContext =
  | "home"
  | "courses"
  | "career"
  | "hackathons"
  | "projects"
  | "achievements"
  | "search"
  | "profile"
  | "account"
  | "default";

export type BackendAssistantContext =
  | "lesson"
  | "course"
  | "dashboard"
  | "course_discovery"
  | "career"
  | "activity"
  | "profile_review"
  | "global";

export type AssistantActionLabel =
  | "coraWidget.actions.browseCourses"
  | "coraWidget.actions.viewPaths"
  | "coraWidget.actions.viewHackathons"
  | "coraWidget.actions.viewProjects"
  | "coraWidget.actions.viewAchievements"
  | "coraWidget.actions.searchAll"
  | "coraWidget.actions.openAccount";

export type AssistantAction = {
  to: string;
  label: AssistantActionLabel;
};

export type AssistantSurfaceMeta = {
  suggestionsKey: `coraWidget.suggestions.${AssistantContext}`;
  action: AssistantAction;
};

// Maps current learner-facing route to the AI context that should shape
// copy, prompt suggestions, and future backend retrieval behavior.
export function resolveAssistantContext(pathname: string): AssistantContext {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/courses")) return "courses";
  if (pathname.startsWith("/career")) return "career";
  if (pathname.startsWith("/achievements")) return "achievements";
  if (pathname.startsWith("/account")) return "account";
  if (pathname.startsWith("/u/") || pathname.startsWith("/users/")) return "profile";
  return "default";
}

export function mapAssistantContextToBackendContext(
  context: AssistantContext | "lesson",
): BackendAssistantContext {
  switch (context) {
    case "lesson":
      return "lesson";
    case "home":
      return "dashboard";
    case "courses":
    case "search":
      return "course_discovery";
    case "career":
      return "career";
    case "hackathons":
    case "projects":
      return "activity";
    case "achievements":
    case "profile":
    case "account":
      return "profile_review";
    default:
      return "global";
  }
}

const ASSISTANT_SURFACE_META: Record<AssistantContext, AssistantSurfaceMeta> = {
  home: {
    suggestionsKey: "coraWidget.suggestions.home",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  courses: {
    suggestionsKey: "coraWidget.suggestions.courses",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  career: {
    suggestionsKey: "coraWidget.suggestions.career",
    action: { to: "/career", label: "coraWidget.actions.viewPaths" },
  },
  // Hackathons & Projects features are hidden from the UI; these contexts are
  // no longer reachable but kept to satisfy the AssistantContext union. Their
  // CTAs fall back to course browsing.
  hackathons: {
    suggestionsKey: "coraWidget.suggestions.hackathons",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  projects: {
    suggestionsKey: "coraWidget.suggestions.projects",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  achievements: {
    suggestionsKey: "coraWidget.suggestions.achievements",
    action: { to: "/achievements", label: "coraWidget.actions.viewAchievements" },
  },
  search: {
    suggestionsKey: "coraWidget.suggestions.search",
    action: { to: "/search", label: "coraWidget.actions.searchAll" },
  },
  profile: {
    suggestionsKey: "coraWidget.suggestions.profile",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  account: {
    suggestionsKey: "coraWidget.suggestions.account",
    action: { to: "/account", label: "coraWidget.actions.openAccount" },
  },
  default: {
    suggestionsKey: "coraWidget.suggestions.default",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
};

// Central metadata for each AI surface so UI copy, prompts, and CTA stay aligned.
export function getAssistantSurfaceMeta(context: AssistantContext): AssistantSurfaceMeta {
  return ASSISTANT_SURFACE_META[context];
}
