import { describe, expect, it } from "vitest";
import { extractOcCredentialId, uuidToTokenId } from "./oc_response";

describe("extractOcCredentialId", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  const urn = `urn:uuid:${uuid}`;
  const tokenId = uuidToTokenId(urn);

  it("extracts direct numeric token fields", () => {
    expect(extractOcCredentialId({ tokenId: 12345 })).toBe("12345");
    expect(extractOcCredentialId({ token_id: "23456" })).toBe("23456");
    expect(extractOcCredentialId({ credentialId: "67890" })).toBe("67890");
    expect(extractOcCredentialId({ credential_id: "78901" })).toBe("78901");
  });

  it("extracts and converts vc.id urn uuid", () => {
    expect(extractOcCredentialId({ vc: { id: urn } })).toBe(tokenId);
  });

  it("extracts and converts root id urn uuid", () => {
    expect(extractOcCredentialId({ id: urn })).toBe(tokenId);
  });

  it("extracts numeric ids from raw text", () => {
    expect(extractOcCredentialId({ raw: "duplicate credentialId=12345" })).toBe("12345");
    expect(extractOcCredentialId({ raw: "already exists tokenId:12345" })).toBe("12345");
    expect(extractOcCredentialId("duplicate credential_id = 98765")).toBe("98765");
    expect(extractOcCredentialId("already exists token_id: 87654")).toBe("87654");
  });

  it("extracts urn uuid from raw text", () => {
    expect(extractOcCredentialId({ raw: `already exists ${urn}` })).toBe(tokenId);
  });

  it("extracts ids from nested string values", () => {
    expect(extractOcCredentialId({ error: { message: "duplicate credentialId: 45678" } })).toBe("45678");
    expect(extractOcCredentialId({ data: [{ detail: `already exists ${urn}` }] })).toBe(tokenId);
  });
});
