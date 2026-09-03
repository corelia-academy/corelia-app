export type AtsDetection = {
  sourceType: "greenhouse" | "lever" | "ashby" | "smartrecruiters";
  sourceIdentifier: string;
  sourceRegion: "global" | "eu";
};

export function detectAtsFromCareersUrl(value: string): AtsDetection | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host) && parts[0]) {
      return { sourceType: "greenhouse", sourceIdentifier: parts[0], sourceRegion: "global" };
    }
    if (["jobs.lever.co", "jobs.eu.lever.co"].includes(host) && parts[0]) {
      return { sourceType: "lever", sourceIdentifier: parts[0], sourceRegion: host.includes(".eu.") ? "eu" : "global" };
    }
    if (["api.lever.co", "api.eu.lever.co"].includes(host)) {
      const postingsIndex = parts.indexOf("postings");
      const identifier = postingsIndex >= 0 ? parts[postingsIndex + 1] : "";
      if (identifier) return { sourceType: "lever", sourceIdentifier: identifier, sourceRegion: host.includes(".eu.") ? "eu" : "global" };
    }
    if (host === "jobs.ashbyhq.com" && parts[0]) {
      return { sourceType: "ashby", sourceIdentifier: parts[0], sourceRegion: "global" };
    }
    if (host === "careers.smartrecruiters.com" && parts[0]) {
      return { sourceType: "smartrecruiters", sourceIdentifier: parts[0], sourceRegion: "global" };
    }
    return null;
  } catch {
    return null;
  }
}

