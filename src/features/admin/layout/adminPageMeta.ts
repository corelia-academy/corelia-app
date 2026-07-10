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
    match: (pathname) => pathname === "/admin/activity-milestones",
    titleKey: "layout.pageMeta.activityMilestones.title",
    descriptionKey: "layout.pageMeta.activityMilestones.description",
  },
  {
    match: (pathname) => pathname === "/admin/manual-mint",
    titleKey: "layout.pageMeta.manualMint.title",
    descriptionKey: "layout.pageMeta.manualMint.description",
  },
  {
    match: (pathname) => pathname === "/admin/cora-vouchers",
    titleKey: "layout.pageMeta.coraVouchers.title",
    descriptionKey: "layout.pageMeta.coraVouchers.description",
  },
  {
    match: (pathname) => pathname === "/admin/branding",
    titleKey: "layout.pageMeta.branding.title",
    descriptionKey: "layout.pageMeta.branding.description",
  },
];

export function resolveAdminPageMeta(pathname: string): AdminPageMeta {
  const current = PAGE_META.find((item) => item.match(pathname)) ?? PAGE_META[0];
  return { titleKey: current.titleKey, descriptionKey: current.descriptionKey };
}
