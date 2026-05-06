export type InstructorCrumb = { label: string; to?: string };

export type InstructorShellMeta = { title: string; description: string };

export function buildInstructorCrumbs({
  pathname,
  needsCourseTitle,
  courseTitle,
  translate,
}: {
  pathname: string;
  needsCourseTitle: boolean;
  courseTitle: string | null;
  translate: (key: string, options?: Record<string, unknown>) => string;
}): InstructorCrumb[] {
  const list: InstructorCrumb[] = [
    { label: translate("layout.crumbs.home"), to: "/" },
    { label: translate("layout.crumbs.teaching"), to: "/instructor/courses" },
  ];

  if (pathname === "/instructor/courses/new") {
    list.push({ label: translate("layout.crumbs.createCourse") });
  } else if (pathname === "/instructor/contracts") {
    list.push({ label: translate("layout.crumbs.contracts") });
  } else if (pathname === "/instructor/invoices") {
    list.push({ label: translate("layout.crumbs.invoices") });
  } else if (pathname === "/instructor/payments") {
    list.push({ label: translate("layout.crumbs.payments") });
  } else if (pathname === "/instructor/profile") {
    list.push({ label: translate("layout.crumbs.profile") });
  } else if (needsCourseTitle) {
    list.push({ label: courseTitle ?? translate("layout.crumbs.course") });
    list.push({ label: translate("layout.crumbs.edit") });
  }

  return list;
}

export function resolveInstructorShellMeta({
  pathname,
  needsCourseTitle,
  courseTitle,
  translate,
}: {
  pathname: string;
  needsCourseTitle: boolean;
  courseTitle: string | null;
  translate: (key: string, options?: Record<string, unknown>) => string;
}): InstructorShellMeta {
  if (pathname === "/instructor/courses/new") {
    return {
      title: translate("layout.shell.newCourse.title"),
      description: translate("layout.shell.newCourse.description"),
    };
  }
  if (pathname === "/instructor/profile") {
    return {
      title: translate("layout.shell.profile.title"),
      description: translate("layout.shell.profile.description"),
    };
  }
  if (pathname === "/instructor/contracts") {
    return {
      title: translate("layout.shell.contracts.title"),
      description: translate("layout.shell.contracts.description"),
    };
  }
  if (pathname === "/instructor/invoices") {
    return {
      title: translate("layout.shell.invoices.title"),
      description: translate("layout.shell.invoices.description"),
    };
  }
  if (pathname === "/instructor/payments") {
    return {
      title: translate("layout.shell.payments.title"),
      description: translate("layout.shell.payments.description"),
    };
  }
  if (needsCourseTitle) {
    return {
      title: courseTitle ?? translate("layout.shell.editCourse.titleFallback"),
      description: translate("layout.shell.editCourse.description"),
    };
  }
  return {
    title: translate("layout.shell.courseList.title"),
    description: translate("layout.shell.courseList.description"),
  };
}

