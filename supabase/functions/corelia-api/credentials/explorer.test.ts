import { describe, expect, it } from "vitest";
import { credentialExplorerUrl } from "./explorer.ts";

describe("credentialExplorerUrl", () => {
  it("opens the exact OCA on sandbox for a connected OCID", () => {
    expect(credentialExplorerUrl({
      credentialId: "credential-123",
      holderOcid: "learner",
      network: "staging",
      isBadge: false,
    })).toBe("https://id.sandbox.opencampus.xyz/public/credentials/details?username=learner.edu&id=credential-123&nftCollection=occredential");
  });

  it("uses mainnet and the badge collection for an OCB", () => {
    expect(credentialExplorerUrl({
      credentialId: "badge 123",
      holderOcid: "learner.edu",
      network: "mainnet",
      isBadge: true,
    })).toBe("https://id.opencampus.xyz/public/credentials/details?username=learner.edu&id=badge%20123&nftCollection=ocbadge");
  });

  it("links by credential id when the holder only has a wallet", () => {
    expect(credentialExplorerUrl({
      credentialId: "credential-123",
      holderOcid: null,
      network: "staging",
      isBadge: false,
    })).toBe("https://id.sandbox.opencampus.xyz/public/credentials?id=credential-123");
  });
});
