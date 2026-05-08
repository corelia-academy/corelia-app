type AdminPageMeta = {
  titleKey: string;
  descriptionKey: string;
};

const PAGE_META: Array<{
  match: (pathname: string) => boolean;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    match: (pathname) => pathname === "/admin" || pathname.startsWith("/admin/users"),
    titleKey: "layout.pageMeta.users.title",
    descriptionKey: "layout.pageMeta.users.description",
  },
  {
    match: (pathname) => pathname === "/admin/dashboard",
    titleKey: "layout.pageMeta.dashboard.title",
    descriptionKey: "layout.pageMeta.dashboard.description",
  },
  {
    match: (pathname) => pathname === "/admin/instructors",
    titleKey: "layout.pageMeta.instructors.title",
    descriptionKey: "layout.pageMeta.instructors.description",
  },
  {
    match: (pathname) => pathname.startsWith("/admin/instructors/"),
    titleKey: "layout.pageMeta.instructorDetail.title",
    descriptionKey: "layout.pageMeta.instructorDetail.description",
  },
  {
    match: (pathname) => pathname.startsWith("/admin/hackathons"),
    titleKey: "layout.pageMeta.contests.title",
    descriptionKey: "layout.pageMeta.contests.description",
  },
];

export function resolveAdminPageMeta(pathname: string): AdminPageMeta {
  const current = PAGE_META.find((item) => item.match(pathname)) ?? PAGE_META[0];
  return { titleKey: current.titleKey, descriptionKey: current.descriptionKey };
}

