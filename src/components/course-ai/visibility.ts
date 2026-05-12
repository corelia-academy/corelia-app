// Learner-facing pages where a lightweight global AI entry point is useful.
// These are discovery, profile, and self-service surfaces for students.
const LEARNER_FACING_EXACT_PATHS = new Set<string>([
  "/courses",
  "/career",
  "/hackathons",
  "/projects",
  "/search",
  "/account",
  "/account/profile",
  "/account/cv",
  "/account/billing",
  "/account/settings",
]);

// Learner-facing detail pages that still benefit from a global AI widget,
// because they do not already embed a dedicated Cora panel.
const LEARNER_FACING_PATTERNS: RegExp[] = [
  /^\/career\/corelia\/[^/]+$/,
  /^\/career\/[^/]+\/[^/]+$/,
  /^\/hackathons\/[^/]+$/,
  /^\/u\/[^/]+$/,
];

// Pages with a stronger in-page Cora surface.
// Global sticky AI should back off here to avoid duplicate chat UI.
const CONTEXTUAL_CORA_SURFACES: RegExp[] = [
  /^\/$/,
  /^\/courses\/[^/]+$/,
  /^\/learn\/.+$/,
];

export function hasDedicatedCoraSurface(pathname: string) {
  return CONTEXTUAL_CORA_SURFACES.some((pattern) => pattern.test(pathname));
}

export function isLearnerFacingAiRoute(pathname: string) {
  if (LEARNER_FACING_EXACT_PATHS.has(pathname)) return true;
  return LEARNER_FACING_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function shouldShowGlobalCoraAssistant(pathname: string) {
  if (hasDedicatedCoraSurface(pathname)) return false;
  return isLearnerFacingAiRoute(pathname);
}
