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
  } else if (pathname === "/instructor/cohorts") {
    list.push({ label: translate("layout.crumbs.offlineClasses") });
  } else if (pathname === "/instructor/cohorts/new") {
    list.push({ label: translate("layout.crumbs.offlineClasses"), to: "/instructor/cohorts" });
    list.push({ label: translate("layout.crumbs.createCohort") });
  } else if (pathname.startsWith("/instructor/cohorts/") && pathname.endsWith("/manage")) {
    list.push({ label: translate("layout.crumbs.offlineClasses"), to: "/instructor/cohorts" });
    list.push({ label: translate("layout.crumbs.cohortWorkspace") });
  } else if (pathname === "/instructor/contests") {
    list.push({ label: translate("layout.crumbs.contests") });
  } else if (pathname === "/instructor/contests/new") {
    list.push({ label: translate("layout.crumbs.contests"), to: "/instructor/contests" });
    list.push({ label: translate("layout.crumbs.createContest") });
  } else if (pathname.startsWith("/instructor/contests/") && pathname.endsWith("/manage")) {
    list.push({ label: translate("layout.crumbs.contests"), to: "/instructor/contests" });
    list.push({ label: translate("layout.crumbs.contestWorkspace") });
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
  if (pathname === "/instructor/cohorts") {
    return {
      title: translate("layout.shell.offlineList.title"),
      description: translate("layout.shell.offlineList.description"),
    };
  }
  if (pathname === "/instructor/cohorts/new") {
    return {
      title: translate("layout.shell.newCohort.title"),
      description: translate("layout.shell.newCohort.description"),
    };
  }
  if (pathname.startsWith("/instructor/cohorts/") && pathname.endsWith("/manage")) {
    return {
      title: translate("layout.shell.cohortWorkspace.title"),
      description: translate("layout.shell.cohortWorkspace.description"),
    };
  }
  if (pathname === "/instructor/contests") {
    return {
      title: translate("layout.shell.contestsList.title"),
      description: translate("layout.shell.contestsList.description"),
    };
  }
  if (pathname === "/instructor/contests/new") {
    return {
      title: translate("layout.shell.newContest.title"),
      description: translate("layout.shell.newContest.description"),
    };
  }
  if (pathname.startsWith("/instructor/contests/") && pathname.endsWith("/manage")) {
    return {
      title: translate("layout.shell.contestWorkspace.title"),
      description: translate("layout.shell.contestWorkspace.description"),
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

