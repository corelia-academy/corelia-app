// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import i18n from "@/i18n";
import {
  PageTitleOverride,
  PageTitleProvider,
  resolvePageTitleKey,
  RoutePageTitleSync,
  useDynamicPageTitle,
} from "@/components/navigation/PageTitle";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("resolvePageTitleKey", () => {
  it.each([
    ["/", "home"],
    ["/projects/new", "newProject"],
    ["/projects/corelia", "projectDetail"],
    ["/jobs/saved", "savedJobs"],
    ["/jobs/react-engineer", "jobDetail"],
    ["/jobs/market/skills/react", "jobs"],
    ["/hackathons/build/prizes", "hackathonPrizes"],
    ["/admin/jobs/sources", "jobSources"],
    ["/instructor/courses/course-1/edit", "editCourse"],
    ["/@learner", "publicProfile"],
    ["/learning-path/legacy", "notFound"],
  ])("maps %s to %s", (pathname, expected) => {
    expect(resolvePageTitleKey(pathname)).toBe(expected);
  });
});

describe("PageTitleProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await i18n.changeLanguage("vi");
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("updates after navigation and language changes", async () => {
    function Controls() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate("/account/settings")}>
          Navigate
        </button>
      );
    }

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <PageTitleProvider>
            <MemoryRouter initialEntries={["/courses"]}>
              <RoutePageTitleSync />
              <Controls />
            </MemoryRouter>
          </PageTitleProvider>
        </I18nextProvider>,
      );
    });
    expect(document.title).toBe("Khóa học · Corelia Academy");

    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(document.title).toBe("Cài đặt · Corelia Academy");

    await act(async () => i18n.changeLanguage("en"));
    expect(document.title).toBe("Settings · Corelia Academy");
  });

  it("uses a screen override and restores the route title on unmount", async () => {
    function Screen({ missing }: { missing: boolean }) {
      return missing ? <PageTitleOverride titleKey="notFound" /> : null;
    }

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <PageTitleProvider>
            <MemoryRouter initialEntries={["/@missing"]}>
              <RoutePageTitleSync />
              <Screen missing />
            </MemoryRouter>
          </PageTitleProvider>
        </I18nextProvider>,
      );
    });
    expect(document.title).toBe("Không tìm thấy trang · Corelia Academy");

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <PageTitleProvider>
            <MemoryRouter initialEntries={["/@missing"]}>
              <RoutePageTitleSync />
              <Screen missing={false} />
            </MemoryRouter>
          </PageTitleProvider>
        </I18nextProvider>,
      );
    });
    expect(document.title).toBe("Hồ sơ công khai · Corelia Academy");
  });

  it("uses localized entity names and appends the brand only once", async () => {
    function CourseTitle({ title }: { title: string | null }) {
      useDynamicPageTitle(title);
      return null;
    }

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <PageTitleProvider>
            <MemoryRouter initialEntries={["/courses/corelia"]}>
              <RoutePageTitleSync />
              <CourseTitle title="Solidity cơ bản" />
            </MemoryRouter>
          </PageTitleProvider>
        </I18nextProvider>,
      );
    });
    expect(document.title).toBe("Solidity cơ bản · Corelia Academy");

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <PageTitleProvider>
            <MemoryRouter initialEntries={["/courses/corelia"]}>
              <RoutePageTitleSync />
              <CourseTitle title="Solidity Basics · Corelia Academy" />
            </MemoryRouter>
          </PageTitleProvider>
        </I18nextProvider>,
      );
    });
    expect(document.title).toBe("Solidity Basics · Corelia Academy");
  });
});
