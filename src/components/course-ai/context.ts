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
  titleKey: `coraWidget.contextTitle.${AssistantContext}`;
  descriptionKey: `coraWidget.contextDescription.${AssistantContext | "guest"}`;
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
  if (pathname.startsWith("/hackathons")) return "hackathons";
  if (pathname.startsWith("/projects")) return "projects";
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
    titleKey: "coraWidget.contextTitle.home",
    descriptionKey: "coraWidget.contextDescription.home",
    suggestionsKey: "coraWidget.suggestions.home",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  courses: {
    titleKey: "coraWidget.contextTitle.courses",
    descriptionKey: "coraWidget.contextDescription.courses",
    suggestionsKey: "coraWidget.suggestions.courses",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  career: {
    titleKey: "coraWidget.contextTitle.career",
    descriptionKey: "coraWidget.contextDescription.career",
    suggestionsKey: "coraWidget.suggestions.career",
    action: { to: "/career", label: "coraWidget.actions.viewPaths" },
  },
  hackathons: {
    titleKey: "coraWidget.contextTitle.hackathons",
    descriptionKey: "coraWidget.contextDescription.hackathons",
    suggestionsKey: "coraWidget.suggestions.hackathons",
    action: { to: "/hackathons", label: "coraWidget.actions.viewHackathons" },
  },
  projects: {
    titleKey: "coraWidget.contextTitle.projects",
    descriptionKey: "coraWidget.contextDescription.projects",
    suggestionsKey: "coraWidget.suggestions.projects",
    action: { to: "/projects", label: "coraWidget.actions.viewProjects" },
  },
  achievements: {
    titleKey: "coraWidget.contextTitle.achievements",
    descriptionKey: "coraWidget.contextDescription.achievements",
    suggestionsKey: "coraWidget.suggestions.achievements",
    action: { to: "/achievements", label: "coraWidget.actions.viewAchievements" },
  },
  search: {
    titleKey: "coraWidget.contextTitle.search",
    descriptionKey: "coraWidget.contextDescription.search",
    suggestionsKey: "coraWidget.suggestions.search",
    action: { to: "/search", label: "coraWidget.actions.searchAll" },
  },
  profile: {
    titleKey: "coraWidget.contextTitle.profile",
    descriptionKey: "coraWidget.contextDescription.profile",
    suggestionsKey: "coraWidget.suggestions.profile",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
  account: {
    titleKey: "coraWidget.contextTitle.account",
    descriptionKey: "coraWidget.contextDescription.account",
    suggestionsKey: "coraWidget.suggestions.account",
    action: { to: "/account", label: "coraWidget.actions.openAccount" },
  },
  default: {
    titleKey: "coraWidget.contextTitle.default",
    descriptionKey: "coraWidget.contextDescription.default",
    suggestionsKey: "coraWidget.suggestions.default",
    action: { to: "/courses", label: "coraWidget.actions.browseCourses" },
  },
};

// Central metadata for each AI surface so UI copy, prompts, and CTA stay aligned.
export function getAssistantSurfaceMeta(context: AssistantContext): AssistantSurfaceMeta {
  return ASSISTANT_SURFACE_META[context];
}
