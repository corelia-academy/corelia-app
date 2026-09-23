// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { UserAvatar } from "@/components/UserAvatar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const USER_ID = "11111111-1111-4111-8111-111111111111";
let cleanup: (() => void) | undefined;

afterEach(() => cleanup?.());

function mount(avatarUrl: string | null) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  act(() => {
    root.render(
      <UserAvatar
        userId={USER_ID}
        avatarUrl={avatarUrl}
        avatarSeed={null}
        alt="Profile avatar"
        fallback="PA"
      />,
    );
  });
  return container;
}

describe("UserAvatar", () => {
  it("renders a generated avatar as the primary image when no custom image exists", () => {
    const container = mount(null);
    const image = container.querySelector<HTMLImageElement>('img[alt="Profile avatar"]');

    expect(image?.src).toMatch(/^data:image\/svg\+xml/);
  });

  it("replaces a legacy uploaded image with a generated avatar", () => {
    const container = mount("https://example.com/missing.png");
    const generatedImage = container.querySelector<HTMLImageElement>('img[alt="Profile avatar"]')!;
    expect(generatedImage.src).toMatch(/^data:image\/svg\+xml/);
  });
});
