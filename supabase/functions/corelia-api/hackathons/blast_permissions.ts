type BlastActorProfile = {
  role?: unknown;
  email?: unknown;
};

type HackathonBlastDocument = {
  co_organizer_emails?: unknown;
};

export function canProfileBlastHackathonEmail(
  profile: BlastActorProfile | null | undefined,
  _document?: HackathonBlastDocument | null | undefined,
): boolean {
  if (!profile) return false;

  const role = String(profile.role ?? "");
  return role === "admin" || role === "support_staff";
}
