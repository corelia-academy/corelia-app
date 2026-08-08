import { describe, expect, it } from "vitest";

import {
  CERTIFICATE_CODE_ALPHABET,
  isCertificateCode,
  normalizeCertificateCode,
} from "./code";

describe("normalizeCertificateCode", () => {
  it("passes a canonical code through unchanged", () => {
    expect(normalizeCertificateCode("CRL-0123456789")).toBe("CRL-0123456789");
  });

  it("uppercases a lowercase code", () => {
    expect(normalizeCertificateCode("crl-abcdefghjk")).toBe("CRL-ABCDEFGHJK");
  });

  it("accepts a code with no prefix", () => {
    expect(normalizeCertificateCode("0123456789")).toBe("CRL-0123456789");
  });

  it("strips whitespace and separators a human retypes off paper", () => {
    expect(normalizeCertificateCode(" 0123 4567 89 ")).toBe("CRL-0123456789");
    expect(normalizeCertificateCode("crl 0123-456789")).toBe("CRL-0123456789");
    expect(normalizeCertificateCode("CRL_0123456789")).toBe("CRL-0123456789");
  });

  it("folds the Crockford confusables O -> 0 and I/L -> 1", () => {
    // The generator never emits O, I or L, so folding them can only ever repair
    // a misread — it can never collide with a real code.
    expect(normalizeCertificateCode("CRL-OIL0123456")).toBe("CRL-0110123456");
  });

  it("rejects a body of the wrong length", () => {
    expect(normalizeCertificateCode("CRL-012345678")).toBeNull();
    expect(normalizeCertificateCode("CRL-01234567890")).toBeNull();
  });

  it("rejects characters outside the alphabet", () => {
    // U is excluded from Crockford base32 and is not folded to anything.
    expect(normalizeCertificateCode("CRL-U123456789")).toBeNull();
  });

  it("rejects empty and non-string input", () => {
    expect(normalizeCertificateCode("")).toBeNull();
    expect(normalizeCertificateCode("   ")).toBeNull();
    expect(normalizeCertificateCode(null)).toBeNull();
    expect(normalizeCertificateCode(undefined)).toBeNull();
    expect(normalizeCertificateCode(1234567890)).toBeNull();
    expect(normalizeCertificateCode({ code: "CRL-0123456789" })).toBeNull();
  });

  it("is idempotent", () => {
    for (const raw of ["CRL-0123456789", "crl 0123-456789", " abcdefghjk "]) {
      const once = normalizeCertificateCode(raw);
      expect(normalizeCertificateCode(once)).toBe(once);
    }
  });
});

describe("isCertificateCode", () => {
  it("mirrors normalizeCertificateCode", () => {
    expect(isCertificateCode("crl 0123-456789")).toBe(true);
    expect(isCertificateCode("nonsense")).toBe(false);
  });
});

describe("CERTIFICATE_CODE_ALPHABET", () => {
  it("is 32 unambiguous Crockford characters", () => {
    expect(CERTIFICATE_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CERTIFICATE_CODE_ALPHABET).size).toBe(32);
    for (const excluded of ["I", "L", "O", "U"]) {
      expect(CERTIFICATE_CODE_ALPHABET).not.toContain(excluded);
    }
  });

  it("matches the alphabet the SQL generator uses", () => {
    // private.generate_certificate_code() hardcodes this same string; if one side
    // changes without the other, codes stop round-tripping through normalization.
    expect(CERTIFICATE_CODE_ALPHABET).toBe("0123456789ABCDEFGHJKMNPQRSTVWXYZ");
  });
});
