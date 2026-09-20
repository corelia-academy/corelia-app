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
    expect(markup).toContain("select-none");
    expect(markup).not.toContain("/icons/action/next.svg");
  });

  it("renders the trailing icon only when enabled", () => {
    const markup = renderAction({
      label: "Settings",
      showIcon: "right",
    });

    expect(markup).toContain('data-slot="action-trailing-icon"');
  });

  it("renders the leading directional icon when selected", () => {
    const markup = renderAction({
      label: "Back",
      showIcon: "left",
    });

    expect(markup).toContain('data-slot="action-leading-icon"');
    expect(markup).not.toContain('data-slot="action-trailing-icon"');
  });

  it("renders both directional icons when selected", () => {
    const markup = renderAction({
      label: "Navigate",
      showIcon: "both",
    });

    expect(markup).toContain('data-slot="action-leading-icon"');
    expect(markup).toContain('data-slot="action-trailing-icon"');
  });

  it("uses the disabled trailing asset when disabled", () => {
    const markup = renderAction({
      label: "Delete account",
      variant: "destructive",
      disabled: true,
      showIcon: "right",
    });

    expect(markup).toContain('data-slot="action-trailing-icon"');
    expect(markup).toContain("text-neutral-500");
    expect(markup).not.toContain("data-disabled:pointer-events-none");
    expect(markup).toContain("data-disabled:cursor-not-allowed");
    expect(markup).toContain("data-disabled:select-none");
  });

  it("does not add hover or pressed styles when disabled", () => {
    const markup = renderAction({
      label: "Disabled action",
      disabled: true,
      hoverAsActive: true,
      showPressed: true,
    });

    expect(markup).toContain("data-disabled:cursor-not-allowed");
    expect(markup).not.toContain("hover:bg-action-hover");
    expect(markup).not.toContain("hover:bg-action-active");
    expect(markup).not.toContain("max-lg:active:bg-action-active");
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
    expect(defaultLarge).toContain("leading-[22px]");

    expect(destructiveSmall).toContain('data-variant="destructive"');
    expect(destructiveSmall).toContain('data-size="small"');
    expect(destructiveSmall).toContain("min-h-[48px]");
    expect(destructiveSmall).toContain("leading-5");
  });

  it("keeps the active color when the active state is hovered", () => {
    const markup = renderAction({
      label: "Selected action",
      isActive: true,
    });

    expect(markup).toContain('data-active="true"');
    expect(markup).toContain("bg-action-active");
    expect(markup).toContain("text-action-active-foreground");
    expect(markup).toContain("data-[active=true]:hover:bg-action-active");
    expect(markup).not.toContain("hover:bg-action-hover");
  });

  it("can disable active visuals when showActive is false", () => {
    const markup = renderAction({
      label: "Menu action",
      isActive: true,
      showActive: false,
    });

    expect(markup).toContain('data-active="true"');
    expect(markup).not.toContain("bg-action-active");
    expect(markup).toContain("hover:bg-action-hover");
  });

  it("adds pressed behavior only when explicitly enabled", () => {
    const markup = renderAction({
      label: "Mobile action",
      isActive: true,
      showPressed: true,
    });

    expect(markup).toContain("max-lg:active:bg-action-active");
  });

  it("supports destructive hover-as-active behavior", () => {
    const markup = renderAction({
      label: "Sign out",
      supportingText: "Sign out of this device",
      variant: "destructive",
      hoverAsActive: true,
      showPressed: true,
    });

    expect(markup).toContain("hover:bg-action-destructive-active");
    expect(markup).toContain("max-lg:active:bg-action-destructive-active");
    expect(markup).toContain("group-hover/action:text-action-destructive-active-foreground");
    expect(markup).not.toContain("group-hover/action:text-neutral-400");
  });

  it("uses the dedicated light icon token for destructive active actions", () => {
    const markup = renderAction({
      label: "Delete account",
      variant: "destructive",
      isActive: true,
      icon: <UserRound />,
      showIcon: "right",
    });

    expect(markup).toContain("text-action-destructive-active-icon");
    expect(markup).toContain('data-slot="action-trailing-icon"');
  });

  it("uses the active icon token for default active actions", () => {
    const markup = renderAction({
      label: "Open details",
      isActive: true,
      icon: <UserRound />,
      showIcon: "right",
    });

    expect(markup).toContain("text-action-active-icon");
    expect(markup).toContain('data-slot="action-trailing-icon"');
  });

  it("keeps default supporting text on the supporting color during hover-as-active", () => {
    const markup = renderAction({
      label: "Open details",
      supportingText: "Description",
      hoverAsActive: true,
      showPressed: true,
    });

    expect(markup).toContain("group-hover/action:text-neutral-400");
    expect(markup).toContain("max-lg:group-active/action:text-neutral-400");
    expect(markup.match(/group-hover\/action:text-action-active-foreground/g)).toHaveLength(1);
  });

  it("can render as a link for menu/list usage", () => {
    const markup = renderAction({
      label: "Profile",
      nativeButton: false,
      render: <a href="/account/profile" />,
    });

    expect(markup).toContain('href="/account/profile"');
  });

  it("uses isActive as the only visual active source", () => {
    const markup = renderAction({
      label: "Profile",
      nativeButton: false,
      render: <a href="/account/profile" aria-current="page" />,
    });

    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-active="false"');
    expect(markup).not.toContain("bg-action-active");
    expect(markup).toContain("text-action-text");
  });
});
