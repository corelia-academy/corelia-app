const LEARNER_FACING_EXACT_PATHS = new Set<string>([
  "/",
  "/courses",
  "/career",
  "/search",
]);

const LEARNER_FACING_PATTERNS: RegExp[] = [
  /^\/courses\/[^/]+$/,
  /^\/learn\/.+$/,
  /^\/career\/corelia\/[^/]+$/,
  /^\/career\/[^/]+\/[^/]+$/,
  /^\/u\/[^/]+$/,
];

export function isLearnerFacingAiRoute(pathname: string) {
  if (LEARNER_FACING_EXACT_PATHS.has(pathname)) return true;
  return LEARNER_FACING_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function shouldShowGlobalCoraAssistant(pathname: string) {
  return isLearnerFacingAiRoute(pathname);
}
