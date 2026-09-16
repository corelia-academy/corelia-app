export type ContactCsvMapping = {
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  locale?: string;
  marketing_consent?: string;
};

export type ContactCsvPreview = {
  headers: string[];
  rows: string[][];
  mapping: ContactCsvMapping;
  invalidEmailRows: number[];
};

const fallbacks: Record<keyof ContactCsvMapping, string[]> = {
  email: ["email", "e-mail", "email address"],
  full_name: ["full_name", "full name", "name", "ho_ten", "họ tên"],
  first_name: ["first_name", "first name", "given name"],
  last_name: ["last_name", "last name", "family name", "surname"],
  locale: ["locale", "language", "ngon_ngu", "ngôn ngữ"],
  marketing_consent: ["marketing_consent", "marketing consent", "consent", "dong_y", "đồng ý"],
};

export function parseContactCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("csv_unclosed_quote");
  row.push(field.replace(/\r$/, ""));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function detectContactCsvMapping(headers: string[]): ContactCsvMapping {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  return Object.fromEntries(Object.entries(fallbacks).flatMap(([field, names]) => {
    const index = normalized.findIndex((header) => names.includes(header));
    return index >= 0 ? [[field, headers[index]]] : [];
  })) as ContactCsvMapping;
}

export function buildContactCsvPreview(input: string): ContactCsvPreview {
  const parsed = parseContactCsv(input);
  if (parsed.length < 2) throw new Error("csv_has_no_data");
  const headers = parsed[0]!.map((header) => header.trim());
  const mapping = detectContactCsvMapping(headers);
  const emailIndex = mapping.email ? headers.indexOf(mapping.email) : -1;
  const invalidEmailRows = parsed.slice(1).map((row, index) => ({ row, number: index + 2 }))
    .filter(({ row }) => emailIndex >= 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((row[emailIndex] ?? "").trim()))
    .map(({ number }) => number);
  return { headers, rows: parsed.slice(1, 11), mapping, invalidEmailRows };
}
