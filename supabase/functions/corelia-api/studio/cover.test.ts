import { describe, expect, it } from "vitest";
import {
  ALLOWED_COLLECTIONS,
  appCoverPath,
  appCoverUrl,
  fetchIconSvg,
  ICONIFY_HOST,
  isSystemCover,
  normalizePathCandidate,
  pathAppearsInTitle,
  prepareSvgForCover,
  queryIconify,
  renderCoverPng,
  resolveCoverPlan,
  svgToDataUri,
} from "./cover.tsx";

const mockStellarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L2 22h20L12 2z"/></svg>`;
const mockRustSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16v16H4z"/></svg>`;
const mockSolanaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#00ffcc" d="M2 12h20v2H2z"/></svg>`;
const mockEthereumSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 0L4 14l8 5 8-5z"/></svg>`;
const mockGoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M0 0h24v24H0z"/></svg>`;
const mockLinuxSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v5a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/></svg>`;

function createMockFetch(
  searchResults: Record<string, string[]>,
  svgContents: Record<string, string> = {},
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    const url = new URL(urlStr);

    if (url.pathname === "/search") {
      const q = url.searchParams.get("query") ?? "";
      const icons = searchResults[q] ?? [];
      return new Response(JSON.stringify({ icons, total: icons.length }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // SVG fetch: /prefix/name.svg
    const parts = url.pathname.slice(1).split("/");
    if (parts.length === 2 && parts[1].endsWith(".svg")) {
      const prefix = parts[0];
      const name = parts[1].replace(".svg", "");
      const key = `${prefix}:${name}`;
      const content = svgContents[key];
      if (!content) return new Response("Not found", { status: 404 });
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml", "Content-Length": String(content.length) },
      });
    }

    return new Response("Not found", { status: 404 });
  }) as typeof fetch;
}

// Standard mock fetch for unit tests without network dependency
const standardMockFetch = createMockFetch(
  {
    stellar: ["simple-icons:stellar", "token-branded:stellar", "token-branded:stellar-background"],
    rust: ["devicon:rust", "simple-icons:rust"],
    solana: ["token-branded:solana", "simple-icons:solana"],
    ethereum: ["token-branded:ethereum", "simple-icons:ethereum"],
    go: ["devicon:go"],
    linux: ["devicon:linux"],
    typescript: ["simple-icons:typescript"],
    arbitrum: ["token:arbitrum-one", "token-branded:arbitrum-one", "token-branded:arbitrum-one-background"],
  },
  {
    "simple-icons:stellar": mockStellarSvg,
    "token-branded:stellar": mockStellarSvg,
    "devicon:rust": mockRustSvg,
    "simple-icons:rust": mockRustSvg,
    "token-branded:solana": mockSolanaSvg,
    "simple-icons:solana": mockSolanaSvg,
    "token-branded:ethereum": mockEthereumSvg,
    "simple-icons:ethereum": mockEthereumSvg,
    "devicon:go": mockGoSvg,
    "devicon:linux": mockLinuxSvg,
    "simple-icons:typescript": `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>`,
    "token-branded:arbitrum-one": `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>`,
  },
);

describe("path candidate normalization and verbatim matching", () => {
  it("normalizes path titles to lowercase alphanumeric", () => {
    expect(normalizePathCandidate("Stellar")).toBe("stellar");
    expect(normalizePathCandidate("TypeScript")).toBe("typescript");
    expect(normalizePathCandidate("Đường Đi")).toBe("duongdi");
    expect(normalizePathCandidate("Front-end Engineer")).toBe("frontendengineer");
    expect(normalizePathCandidate("Smart contract security")).toBe("smartcontractsecurity");
    expect(normalizePathCandidate("Back-end")).toBe("backend");
  });

  it("identifies verbatim appearance of path title in course title", () => {
    expect(pathAppearsInTitle("Stellar", "Làm quen với Stellar blockchain")).toEqual({ appears: true, index: 13 });
    expect(pathAppearsInTitle("Rust", "Rust cho Solana")).toEqual({ appears: true, index: 0 });
    expect(pathAppearsInTitle("Solana", "Rust cho Solana")).toEqual({ appears: true, index: 9 });
    expect(pathAppearsInTitle("Go", "Lập trình Go nâng cao")).toEqual({ appears: true, index: 10 });
    expect(pathAppearsInTitle("Linux", "Quản trị hệ thống Linux")).toEqual({ appears: true, index: 18 });
  });

  it("rejects partial substring matches that are not intact words", () => {
    // "Go" should not match inside "Google"
    expect(pathAppearsInTitle("Go", "Google Cloud Platform").appears).toBe(false);
    // "Rust" should not match inside "Trustless"
    expect(pathAppearsInTitle("Rust", "Hệ thống Trustless").appears).toBe(false);
    // "Front-end Engineer" does not appear intact in "Nhập môn Front-end"
    expect(pathAppearsInTitle("Front-end Engineer", "Nhập môn Front-end").appears).toBe(false);
  });
});

describe("Iconify query and SVG validation", () => {
  it("matches exact name in simple-icons, devicon, logos, token-branded", async () => {
    const stellar = await queryIconify("stellar", standardMockFetch);
    expect(stellar).toEqual({ prefix: "simple-icons", name: "stellar" });

    const rust = await queryIconify("rust", standardMockFetch);
    expect(rust?.name).toBe("rust");
    expect(["simple-icons", "devicon"]).toContain(rust?.prefix);
  });

  it("allows identifier suffix in token-branded but disallows -background", async () => {
    const arb = await queryIconify("arbitrum", standardMockFetch);
    expect(arb).toEqual({ prefix: "token-branded", name: "arbitrum-one" });
  });

  it("rejects partial candidate name matches (e.g. rustfs for rust)", async () => {
    const isolatedFetch = createMockFetch({
      rust: ["simple-icons:rustfs", "token-branded:trust"],
    });
    const match = await queryIconify("rust", isolatedFetch);
    expect(match).toBeNull();
  });

  it("rejects non-SVG content or oversized responses (>100KB)", async () => {
    const badSvgFetch = (async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("toolarge")) {
        const big = "<svg>" + "a".repeat(105 * 1024) + "</svg>";
        return new Response(big, { status: 200, headers: { "Content-Length": String(big.length) } });
      }
      if (u.includes("not-svg")) {
        return new Response("<html>Not an svg</html>", { status: 200 });
      }
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    expect(await fetchIconSvg("logos", "toolarge", badSvgFetch)).toBeNull();
    expect(await fetchIconSvg("logos", "not-svg", badSvgFetch)).toBeNull();
  });

  it("rejects HTTP redirects", async () => {
    const redirectFetch = (async () => new Response(null, { status: 302, headers: { Location: "https://evil.com" } })) as typeof fetch;
    expect(await queryIconify("rust", redirectFetch)).toBeNull();
    expect(await fetchIconSvg("devicon", "rust", redirectFetch)).toBeNull();
  });
});

describe("V-01 contract verification: logo selection and false-positive elimination", () => {
  it("resolves to TEXT for all titles from Reviewer Evidence where Vietnamese words collided with logos", async () => {
    // 1. "Khóa học về phát triển ứng dụng hiện đại" -> must be text, NOT 'dai' (DAI)
    const p1 = await resolveCoverPlan(
      "Khóa học về phát triển ứng dụng hiện đại",
      [{ title: "Front-end Engineer", learning_order: 1 }],
      standardMockFetch,
    );
    expect(p1.kind).toBe("text");
    expect((p1 as { text: string }).text).toBe("Front-end Engineer");

    // 2. "Tối ưu hiệu năng dài hạn" -> must be text, NOT 'dai' (DAI)
    const p2 = await resolveCoverPlan("Tối ưu hiệu năng dài hạn", [], standardMockFetch);
    expect(p2.kind).toBe("text");
    expect((p2 as { text: string }).text).toBe("Tối ưu hiệu năng dài hạn");

    // 3. "Nhập môn Front-end" with path "Front-end Engineer" -> must be text, NOT 'front'
    const p3 = await resolveCoverPlan(
      "Nhập môn Front-end",
      [{ title: "Front-end Engineer", learning_order: 1 }],
      standardMockFetch,
    );
    expect(p3.kind).toBe("text");
    expect((p3 as { text: string }).text).toBe("Front-end Engineer");

    // 4. "Bảo mật Smart Contract" with path "Smart contract security" -> must be text, NOT 'smart'
    const p4 = await resolveCoverPlan(
      "Bảo mật Smart Contract",
      [{ title: "Smart contract security", learning_order: 1 }],
      standardMockFetch,
    );
    expect(p4.kind).toBe("text");
    expect((p4 as { text: string }).text).toBe("Smart contract security");

    // 5. "Phân tích dữ liệu on-chain" with path "On-chain data analysis" -> must be text, NOT 'data'
    const p5 = await resolveCoverPlan(
      "Phân tích dữ liệu on-chain",
      [{ title: "On-chain data analysis", learning_order: 1 }],
      standardMockFetch,
    );
    expect(p5.kind).toBe("text");
    expect((p5 as { text: string }).text).toBe("On-chain data analysis");

    // 6. "Kiến trúc Zero Knowledge" with path "Zero Knowledge" -> must be text, NOT 'zero'
    const p6 = await resolveCoverPlan(
      "Kiến trúc Zero Knowledge",
      [{ title: "Zero Knowledge", learning_order: 1 }],
      standardMockFetch,
    );
    expect(p6.kind).toBe("text");
    expect((p6 as { text: string }).text).toBe("Zero Knowledge");

    // 7. "Quản lý sản phẩm Web3" with path "Product Management" -> must be text, NOT 'san'
    const p7 = await resolveCoverPlan(
      "Quản lý sản phẩm Web3",
      [{ title: "Product Management", learning_order: 1 }],
      standardMockFetch,
    );
    expect(p7.kind).toBe("text");
    expect((p7 as { text: string }).text).toBe("Product Management");

    // 8. "Hợp đồng thông minh nâng cao" with path "Advanced Smart Contracts" -> must be text, NOT 'hop'
    const p8 = await resolveCoverPlan(
      "Hợp đồng thông minh nâng cao",
      [{ title: "Advanced Smart Contracts", learning_order: 1 }],
      standardMockFetch,
    );
    expect(p8.kind).toBe("text");
    expect((p8 as { text: string }).text).toBe("Advanced Smart Contracts");
  });

  it("resolves to text for general roles and concepts: Back-end, Full-stack, Prompt Engineering, Raft, Design", async () => {
    const textCases = [
      { title: "Lộ trình Back-end", path: "Back-end" },
      { title: "Trở thành Full-stack Developer", path: "Full-stack" },
      { title: "Prompt Engineering căn bản", path: "Prompt Engineering" },
      { title: "Thuật toán đồng thuận Raft", path: "Raft" },
      { title: "Nguyên lý UI/UX Design", path: "Design" },
    ];

    for (const tc of textCases) {
      const plan = await resolveCoverPlan(tc.title, [{ title: tc.path, learning_order: 1 }], standardMockFetch);
      expect(plan.kind).toBe("text");
      if (plan.kind === "text") {
        expect(plan.text).toBe(tc.path);
      }
    }
  });

  it("correctly identifies Ethereum logo in 'Nhập môn Smart Contract trên Ethereum' without picking up 'smart'", async () => {
    const plan = await resolveCoverPlan(
      "Nhập môn Smart Contract trên Ethereum",
      [
        { title: "Ethereum", learning_order: 1 },
        { title: "Smart contract security", learning_order: 2 },
      ],
      standardMockFetch,
    );
    expect(plan.kind).toBe("logo");
    if (plan.kind === "logo") {
      expect(plan.logos).toHaveLength(1);
      expect(plan.logos[0].name).toBe("ethereum");
    }
  });

  it("correctly selects single primary logo for Stellar, Go, Linux when in title", async () => {
    // Stellar
    const pStellar = await resolveCoverPlan(
      "Làm quen với Stellar blockchain",
      [{ title: "Stellar", learning_order: 1 }],
      standardMockFetch,
    );
    expect(pStellar.kind).toBe("logo");
    if (pStellar.kind === "logo") {
      expect(pStellar.logos).toHaveLength(1);
      expect(pStellar.logos[0].name).toBe("stellar");
    }

    // Go
    const pGo = await resolveCoverPlan(
      "Lập trình Go cơ bản",
      [{ title: "Go", learning_order: 1 }],
      standardMockFetch,
    );
    expect(pGo.kind).toBe("logo");
    if (pGo.kind === "logo") {
      expect(pGo.logos).toHaveLength(1);
      expect(pGo.logos[0].name).toBe("go");
    }

    // Linux
    const pLinux = await resolveCoverPlan(
      "Quản trị hệ thống Linux",
      [{ title: "Linux", learning_order: 1 }],
      standardMockFetch,
    );
    expect(pLinux.kind).toBe("logo");
    if (pLinux.kind === "logo") {
      expect(pLinux.logos).toHaveLength(1);
      expect(pLinux.logos[0].name).toBe("linux");
    }
  });

  it("picks both logos side-by-side when title names two technologies with paths (Rust cho Solana)", async () => {
    const plan = await resolveCoverPlan(
      "Rust cho Solana",
      [
        { title: "Rust", learning_order: 1 },
        { title: "Solana", learning_order: 2 },
      ],
      standardMockFetch,
    );
    expect(plan.kind).toBe("logo");
    if (plan.kind === "logo") {
      expect(plan.logos).toHaveLength(2);
      expect(plan.logos[0].name).toBe("rust");
      expect(plan.logos[1].name).toBe("solana");
    }
  });

  it("picks path with lowest learning_order that has a logo when no path appears in title", async () => {
    const plan = await resolveCoverPlan(
      "Khóa học lập trình hệ thống hiện đại",
      [
        { title: "Front-end Engineer", learning_order: 1 },
        { title: "Rust", learning_order: 2 },
        { title: "Solana", learning_order: 3 },
      ],
      standardMockFetch,
    );
    expect(plan.kind).toBe("logo");
    if (plan.kind === "logo") {
      expect(plan.logos).toHaveLength(1);
      expect(plan.logos[0].name).toBe("rust");
    }
  });

  it("falls back to course title when course has no paths", async () => {
    const plan = await resolveCoverPlan("Khóa học không có path nào", [], standardMockFetch);
    expect(plan).toEqual({ kind: "text", text: "Khóa học không có path nào" });
  });
});

describe("PNG rendering and layout", () => {
  it("renders a 1200x675 PNG for 1 logo (Stellar)", async () => {
    const png = await renderCoverPng({
      kind: "logo",
      logos: [{ name: "stellar", svg: mockStellarSvg }],
    });
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(675);
  });

  it("renders a 1200x675 PNG for 2 logos (Rust + Solana)", async () => {
    const png = await renderCoverPng({
      kind: "logo",
      logos: [
        { name: "rust", svg: mockRustSvg },
        { name: "solana", svg: mockSolanaSvg },
      ],
    });
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(675);
  });

  it("renders text cover with full Vietnamese diacritics and auto word wrapping", async () => {
    const longText = "Khóa học chuyên sâu về phát triển ứng dụng phi tập trung và kiến trúc hệ thống hiện đại";
    const png = await renderCoverPng({
      kind: "text",
      text: longText,
    });
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(675);
  });
});

describe("storage path and operator thumbnail protection", () => {
  const courseId = "11111111-2222-3333-4444-555555555555";

  it("constructs correct storage path", () => {
    expect(appCoverPath(courseId)).toBe(`course-thumbnails/${courseId}/cover.png`);
  });

  it("identifies empty or system-generated cover as overwritable", () => {
    expect(isSystemCover("", courseId)).toBe(true);
    expect(isSystemCover(null, courseId)).toBe(true);
    expect(isSystemCover(undefined, courseId)).toBe(true);
    expect(isSystemCover(`http://localhost:54321/storage/v1/object/public/app/course-thumbnails/${courseId}/cover.png`, courseId)).toBe(true);
  });

  it("preserves manual operator thumbnails", () => {
    expect(isSystemCover(`https://cdn.example.com/custom-artwork.jpg`, courseId)).toBe(false);
    expect(isSystemCover(`http://localhost:54321/storage/v1/object/public/app/course-thumbnails/${courseId}/manual-upload-123.png`, courseId)).toBe(false);
  });
});

// V-02: Sample image writing is only enabled when COVER_SAMPLES_DIR is explicitly provided
describe("sample covers output for visual inspection (opt-in)", () => {
  it.skipIf(!process.env.COVER_SAMPLES_DIR)("writes sample covers to specified directory", async () => {
    const outDir = process.env.COVER_SAMPLES_DIR!;
    const fs = await import("node:fs/promises");
    await fs.mkdir(outDir, { recursive: true });

    // 1. Stellar logo
    const planStellar = await resolveCoverPlan(
      "Làm quen với Stellar blockchain",
      [{ title: "Stellar", learning_order: 1 }],
      standardMockFetch,
    );
    expect(planStellar.kind).toBe("logo");
    const pngStellar = await renderCoverPng(planStellar);
    await fs.writeFile(`${outDir}/stellar.png`, pngStellar);

    // 2. Rust (+ Solana) logo
    const planRust = await resolveCoverPlan(
      "Rust cho Solana",
      [{ title: "Rust", learning_order: 0 }, { title: "Solana", learning_order: 1 }],
      standardMockFetch,
    );
    expect(planRust.kind).toBe("logo");
    const pngRust = await renderCoverPng(planRust);
    await fs.writeFile(`${outDir}/rust.png`, pngRust);

    // 3. Prompt Engineering (text)
    const planPrompt = await resolveCoverPlan(
      "Prompt Engineering",
      [{ title: "Prompt Engineering", learning_order: 1 }],
      standardMockFetch,
    );
    expect(planPrompt.kind).toBe("text");
    const pngPrompt = await renderCoverPng(planPrompt);
    await fs.writeFile(`${outDir}/prompt-engineering.png`, pngPrompt);

    // 4. Long Vietnamese text -> must be text!
    const longViTitle = "Khóa học chuyên sâu về phát triển ứng dụng phi tập trung và kiến trúc hệ thống hiện đại";
    const planVi = await resolveCoverPlan(longViTitle, [], standardMockFetch);
    expect(planVi.kind).toBe("text");
    const pngVi = await renderCoverPng(planVi);
    await fs.writeFile(`${outDir}/vietnamese-long-title.png`, pngVi);
  });
});

// V-02: Live Iconify API verification is only executed when COVER_LIVE=1 is set
describe("live Iconify API contract verification (opt-in)", () => {
  it.skipIf(process.env.COVER_LIVE !== "1")("confirms edge cases against live Iconify API", async () => {
    // Must find logos:
    const stellar = await queryIconify("stellar");
    expect(stellar).not.toBeNull();
    expect(ALLOWED_COLLECTIONS.has(stellar!.prefix)).toBe(true);

    const solana = await queryIconify("solana");
    expect(solana).not.toBeNull();

    const rust = await queryIconify("rust");
    expect(rust).not.toBeNull();

    const ts = await queryIconify("typescript");
    expect(ts).not.toBeNull();

    const eth = await queryIconify("ethereum");
    expect(eth).not.toBeNull();

    const stellarPlan = await resolveCoverPlan("Làm quen với Stellar blockchain", [{ title: "Stellar", learning_order: 1 }]);
    expect(stellarPlan.kind).toBe("logo");

    const movePlan = await resolveCoverPlan("Lập trình Move cơ bản", [{ title: "Move", learning_order: 1 }]);
    expect(movePlan.kind).toBe("text");
    expect((movePlan as { text: string }).text).toBe("Move");

    const promptPlan = await resolveCoverPlan("Prompt Engineering", [{ title: "Prompt Engineering", learning_order: 1 }]);
    expect(promptPlan.kind).toBe("text");
    expect((promptPlan as { text: string }).text).toBe("Prompt Engineering");
  });
});
