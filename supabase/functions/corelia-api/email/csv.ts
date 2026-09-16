export type CsvRow = string[];

/** RFC 4180-compatible parser with BOM, quoted commas, quotes and newlines. */
export function parseCsv(input: string): CsvRow[] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("csv_unclosed_quote");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function consentFromCsv(value: string): boolean {
  return /^(1|true|yes|y|co|có|dong y|đồng ý)$/i.test(value.trim());
}

export type ContactColumnMapping = {
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  locale?: string;
  marketing_consent?: string;
};

const CONTACT_COLUMN_FALLBACKS: Record<keyof ContactColumnMapping, string[]> = {
  email: ["email", "e-mail", "email address"],
  full_name: ["full_name", "full name", "name", "ho_ten", "họ tên"],
  first_name: ["first_name", "first name", "given name"],
  last_name: ["last_name", "last name", "family name", "surname"],
  locale: ["locale", "language", "ngon_ngu", "ngôn ngữ"],
  marketing_consent: ["marketing_consent", "marketing consent", "consent", "dong_y", "đồng ý"],
};

export function contactColumnIndex(headers: string[], field: keyof ContactColumnMapping, mapping: ContactColumnMapping = {}): number {
  const normalized = headers.map((value) => value.trim().toLowerCase());
  const configured = mapping[field]?.trim().toLowerCase();
  return configured ? normalized.indexOf(configured) : normalized.findIndex((header) => CONTACT_COLUMN_FALLBACKS[field].includes(header));
}

export function contactNameFromCsv(row: CsvRow, headers: string[], mapping: ContactColumnMapping = {}): string | null {
  const fullNameIndex = contactColumnIndex(headers, "full_name", mapping);
  if (fullNameIndex >= 0) return row[fullNameIndex]?.trim() || null;
  const firstNameIndex = contactColumnIndex(headers, "first_name", mapping);
  const lastNameIndex = contactColumnIndex(headers, "last_name", mapping);
  const name = [firstNameIndex >= 0 ? row[firstNameIndex] : "", lastNameIndex >= 0 ? row[lastNameIndex] : ""]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  return name || null;
}
