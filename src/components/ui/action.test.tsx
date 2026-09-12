// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserRound } from "lucide-react";

import { Action } from "./action";

function renderAction(props: Parameters<typeof Action>[0]) {
  return renderToStaticMarkup(<Action {...props} />);
}

describe("Action", () => {
  it("renders optional icon and supporting text", () => {
    const markup = renderAction({
      label: "Personal info",
      supportingText: "Name, contact, avatar",
      icon: <UserRound data-testid="leading-icon" />,
    });

    expect(markup).toContain("Personal info");
    expect(markup).toContain("Name, contact, avatar");
    expect(markup).toContain('data-testid="leading-icon"');
    expect(markup).not.toContain("/icons/action/next.svg");
  });

  it("renders the trailing icon only when enabled", () => {
    const markup = renderAction({
      label: "Settings",
      showTrailingIcon: true,
    });

    expect(markup).toContain("/icons/action/next.svg");
  });

  it("uses the disabled trailing asset when disabled", () => {
    const markup = renderAction({
      label: "Delete account",
      variant: "destructive",
      disabled: true,
      showTrailingIcon: true,
    });

    expect(markup).toContain("/icons/action/next-disabled.svg");
  });

  it("supports default/destructive variants and large/small sizes", () => {
    const defaultLarge = renderAction({
      label: "Default action",
      variant: "default",
      size: "large",
    });

    const destructiveSmall = renderAction({
      label: "Delete account",
      variant: "destructive",
      size: "small",
    });

    expect(defaultLarge).toContain('data-variant="default"');
    expect(defaultLarge).toContain('data-size="large"');
    expect(defaultLarge).toContain("min-h-[60px]");

    expect(destructiveSmall).toContain('data-variant="destructive"');
    expect(destructiveSmall).toContain('data-size="small"');
    expect(destructiveSmall).toContain("min-h-[48px]");
  });

  it("keeps the active color when the active state is hovered", () => {
    const markup = renderAction({
      label: "Selected action",
      isActive: true,
    });

    expect(markup).toContain('data-active="true"');
    expect(markup).toContain("bg-blue-900");
    expect(markup).toContain("data-[active=true]:hover:bg-blue-900");
    expect(markup).not.toContain("hover:bg-action-hover");
  });

  it("can disable active visuals when showActive is false", () => {
    const markup = renderAction({
      label: "Menu action",
      isActive: true,
      showActive: false,
    });

    expect(markup).toContain('data-active="true"');
    expect(markup).not.toContain("bg-blue-900");
    expect(markup).toContain("hover:bg-action-hover");
  });

  it("adds pressed behavior only when explicitly enabled", () => {
    const markup = renderAction({
      label: "Mobile action",
      isActive: true,
      showPressed: true,
    });

    expect(markup).toContain("max-lg:active:bg-blue-900");
  });

  it("supports destructive hover-as-active behavior", () => {
    const markup = renderAction({
      label: "Sign out",
      variant: "destructive",
      hoverAsActive: true,
      showPressed: true,
    });

    expect(markup).toContain("hover:bg-error-700");
    expect(markup).toContain("max-lg:active:bg-error-700");
  });

  it("can render as a link for menu/list usage", () => {
    const markup = renderAction({
      label: "Profile",
      nativeButton: false,
      render: <a href="/account/profile" />,
    });

    expect(markup).toContain('href="/account/profile"');
  });
});
