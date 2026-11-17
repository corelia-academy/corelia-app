import { describe, expect, it } from "vitest";
import {
  ALLOWED_CHANNELS,
  channelsForTrack,
  extractChannelHandle,
  findAllowedChannelByName,
  findChannelByHandle,
  isAllowedChannel,
} from "./channels.ts";

describe("studio channels configuration", () => {
  it("contains unique approved channels with valid lowercase handles and tracks", () => {
    expect(ALLOWED_CHANNELS).toHaveLength(49);
    const handles = new Set<string>();
    for (const c of ALLOWED_CHANNELS) {
      expect(c.name).toBeTruthy();
      expect(c.handle).toMatch(/^@[a-z0-9_.-]+$/);
      expect(c.tracks.length).toBeGreaterThan(0);
      expect(handles.has(c.handle)).toBe(false);
      handles.add(c.handle);
    }
    const names = ALLOWED_CHANNELS.map((c) => c.name);
    expect(names).toContain("freeCodeCamp.org");
    expect(names).toContain("Programming with Mosh");
    expect(names).toContain("Traversy Media");
    expect(names).toContain("Net Ninja");
    expect(names).toContain("Web Dev Simplified");
    expect(names).toContain("Academind");
    expect(names).toContain("Patrick Collins");
    expect(names).toContain("Chainlink");
    expect(names).toContain("Ethereum Foundation");
    expect(names).toContain("Smart Contract Programmer");
    expect(names).toContain("Let's Get Rusty");
    expect(names).toContain("3Blue1Brown");
    expect(names).toContain("Google for Developers");
    expect(names).toContain("ByteByteGo");
    expect(names).toContain("NeetCode");
    expect(names).toContain("GitHub");
    expect(names).toContain("CNCF [Cloud Native Computing Foundation]");
    expect(names).toContain("Anthropic");
    expect(names).toContain("Hussein Nasser");
    expect(names).toContain("Solana");
    expect(names).toContain("Cyfrin Audits");
    expect(names).toContain("Vercel");
  });

  it("filters approved channels by track and falls back to all channels when track is missing or unknown", () => {
    const backend = channelsForTrack("backend").map((c) => c.handle);
    expect(backend).toContain("@hnasr");
    expect(backend).toContain("@bytebytego");
    expect(backend).not.toContain("@solana");

    const ai = channelsForTrack("ai-engineer").map((c) => c.handle);
    expect(ai).toContain("@anthropic-ai");
    expect(ai).toContain("@deeplearningai");

    expect(channelsForTrack()).toHaveLength(ALLOWED_CHANNELS.length);
    expect(channelsForTrack("non-existent-track")).toHaveLength(ALLOWED_CHANNELS.length);
  });

  it("matches channel names case-insensitively, normalizes quotes/spaces, and handles aliases", () => {
    expect(isAllowedChannel("freeCodeCamp.org")).toBe(true);
    expect(isAllowedChannel("FreeCodeCamp.ORG")).toBe(true);
    expect(isAllowedChannel("  freecodecamp.org  ")).toBe(true);
    expect(isAllowedChannel("Let's Get Rusty")).toBe(true);
    expect(isAllowedChannel("Let’s Get Rusty")).toBe(true); // smart apostrophe
    expect(isAllowedChannel("CNCF")).toBe(true); // alias
    expect(isAllowedChannel("CNCF [Cloud Native Computing Foundation]")).toBe(true);
    expect(isAllowedChannel("Unknown Channel")).toBe(false);
    expect(isAllowedChannel("")).toBe(false);
  });

  it("extracts and matches handle from author_url correctly", () => {
    expect(extractChannelHandle("https://www.youtube.com/@freecodecamp")).toBe("@freecodecamp");
    expect(extractChannelHandle("https://www.youtube.com/@FreeCodeCamp")).toBe("@freecodecamp");
    expect(extractChannelHandle("https://www.youtube.com/@cncf")).toBe("@cncf");
    expect(extractChannelHandle("https://www.youtube.com/@PatrickAlphaC")).toBe("@patrickalphac");
    expect(extractChannelHandle("https://www.youtube.com/channel/UC8butISFwT-Wl7EV0hUK0BQ")).toBeNull();
    expect(extractChannelHandle(null)).toBeNull();
    expect(extractChannelHandle("")).toBeNull();

    expect(findChannelByHandle("@freecodecamp")?.name).toBe("freeCodeCamp.org");
    expect(findChannelByHandle("@CNCF")?.name).toBe("CNCF [Cloud Native Computing Foundation]");
    expect(findChannelByHandle("@unknown")).toBeUndefined();
  });

  it("finds allowed channel by name or alias", () => {
    expect(findAllowedChannelByName("CNCF")?.handle).toBe("@cncf");
    expect(findAllowedChannelByName("cncf [cloud native computing foundation]")?.handle).toBe("@cncf");
    expect(findAllowedChannelByName("Let’s Get Rusty")?.handle).toBe("@letsgetrusty");
  });
});
