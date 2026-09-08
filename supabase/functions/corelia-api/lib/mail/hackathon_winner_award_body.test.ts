import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildHackathonWinnerAwardEmail } from "./hackathon_winner_award_body.ts";

describe("buildHackathonWinnerAwardEmail", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "https://app.corelia.academy" } });
  });
  it("builds Vietnamese award email correctly", () => {
    const result = buildHackathonWinnerAwardEmail({
      hackathonTitle: "Corelia AI Hackathon 2026",
      projectTitle: "AI Doc Assistant",
      awardLabel: "Giải Nhất",
      hackathonHref: "https://corelia.academy/hackathons/ai-hackathon-2026",
      locale: "vi",
    });

    expect(result.subject).toContain("Chúc mừng! Dự án \"AI Doc Assistant\" đạt giải Giải Nhất — Corelia AI Hackathon 2026");
    expect(result.html).toContain("AI Doc Assistant");
    expect(result.html).toContain("Giải Nhất");
    expect(result.html).toContain("Corelia AI Hackathon 2026");
    expect(result.html).toContain("https://corelia.academy/hackathons/ai-hackathon-2026");
    expect(result.html).toContain("Xem cuộc thi →");
  });

  it("builds English award email correctly", () => {
    const result = buildHackathonWinnerAwardEmail({
      hackathonTitle: "Global Web3 Hackathon",
      projectTitle: "DeFi Lending Protocol",
      awardLabel: "First Prize",
      hackathonHref: "https://corelia.academy/hackathons/global-web3",
      locale: "en",
    });

    expect(result.subject).toContain("Congratulations! \"DeFi Lending Protocol\" won First Prize — Global Web3 Hackathon");
    expect(result.html).toContain("DeFi Lending Protocol");
    expect(result.html).toContain("First Prize");
    expect(result.html).toContain("Global Web3 Hackathon");
    expect(result.html).toContain("https://corelia.academy/hackathons/global-web3");
    expect(result.html).toContain("View hackathon →");
  });

  it("uses project-specific CTA text when link points to /projects/:slug", () => {
    const viResult = buildHackathonWinnerAwardEmail({
      hackathonTitle: "Corelia AI Hackathon 2026",
      projectTitle: "AI Doc Assistant",
      awardLabel: "Giải Nhất",
      hackathonHref: "https://corelia.academy/projects/ai-doc-assistant",
      locale: "vi",
    });
    expect(viResult.html).toContain("https://corelia.academy/projects/ai-doc-assistant");
    expect(viResult.html).toContain("Xem chi tiết giải thưởng →");
    expect(viResult.html).not.toContain("Xem cuộc thi →");

    const enResult = buildHackathonWinnerAwardEmail({
      hackathonTitle: "Global Web3 Hackathon",
      projectTitle: "DeFi Lending Protocol",
      awardLabel: "First Prize",
      hackathonHref: "https://corelia.academy/projects/defi-lending-protocol",
      locale: "en",
    });
    expect(enResult.html).toContain("https://corelia.academy/projects/defi-lending-protocol");
    expect(enResult.html).toContain("View award details →");
    expect(enResult.html).not.toContain("View hackathon →");
  });

  it("handles fallback values gracefully for Vietnamese", () => {
    const result = buildHackathonWinnerAwardEmail({
      hackathonTitle: "",
      projectTitle: "",
      awardLabel: "",
      locale: "vi",
    });

    expect(result.subject).toContain("Dự án");
    expect(result.subject).toContain("Giải thưởng");
    expect(result.subject).toContain("Cuộc thi");
  });

  it("handles fallback values gracefully for default locale", () => {
    const result = buildHackathonWinnerAwardEmail({
      hackathonTitle: "",
      projectTitle: "",
      awardLabel: "",
      locale: null,
    });

    expect(result.subject).toContain("Project");
    expect(result.subject).toContain("Award");
    expect(result.subject).toContain("Hackathon");
  });
});
