type BlastActorProfile = {
  role?: unknown;
  email?: unknown;
};

type HackathonBlastDocument = {
  co_organizer_emails?: unknown;
};

function normalizedEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function emailListIncludes(list: unknown, email: string): boolean {
  return (
    Array.isArray(list) &&
    list.some((item) => normalizedEmail(item) === email)
  );
}

export function canProfileBlastHackathonEmail(
  profile: BlastActorProfile | null | undefined,
  document: HackathonBlastDocument | null | undefined,
): boolean {
  if (!profile) return false;

  const role = String(profile.role ?? "");
  if (role === "admin" || role === "support_staff") return true;

  const email = normalizedEmail(profile.email);
  if (!email || !document) return false;

  // co_organizer_emails = full co-host with management permissions.
  return emailListIncludes(document.co_organizer_emails, email);
}
