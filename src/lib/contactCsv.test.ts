import { describe, expect, it } from "vitest";
import { buildContactCsvPreview, parseContactCsv } from "./contactCsv";

describe("contact CSV preview", () => {
  it("parses RFC 4180 content and detects Luma-style columns", () => {
    const preview = buildContactCsvPreview('\uFEFFEmail Address,First Name,Last Name,Language\r\na@example.com,"Nguyễn, An",Lê,vi');
    expect(preview.mapping).toEqual({ email: "Email Address", first_name: "First Name", last_name: "Last Name", locale: "Language" });
    expect(preview.rows[0]).toEqual(["a@example.com", "Nguyễn, An", "Lê", "vi"]);
    expect(preview.invalidEmailRows).toEqual([]);
  });

  it("rejects unclosed quotes and reports invalid email rows", () => {
    expect(() => parseContactCsv('email\n"broken')).toThrow("csv_unclosed_quote");
    expect(buildContactCsvPreview("email,name\ninvalid,An").invalidEmailRows).toEqual([2]);
  });
});
