import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  renderDiagramPng,
  FontLoadError,
  registerFontBuffer,
  clearFontRegistry,
  setFontResolver,
} from "./diagram_render.ts";
import type { Diagram } from "./diagram.ts";

function loadFixtureFont(name: string): Uint8Array {
  const p = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return new Uint8Array(fs.readFileSync(p));
}

const fonts = {
  "zh-CN": loadFixtureFont("noto-sc-test.ttf"),
  "zh-TW": loadFixtureFont("noto-tc-test.ttf"),
  "ko": loadFixtureFont("noto-kr-test.ttf"),
  "ja": loadFixtureFont("noto-ja-test.ttf"),
};

const sampleDiagram = (labels: [string, string], title = "Diagram Title"): Diagram => ({
  id: "d1",
  title,
  alt: "Sample diagram",
  nodes: [
    { id: "a", label: labels[0], shape: "rectangle", col: 0, row: 0 },
    { id: "b", label: labels[1], shape: "rectangle", col: 1, row: 0 },
  ],
  edges: [
    { from: "a", to: "b", style: "solid", route: "straight", label: "" },
  ],
});

describe("diagram_render: CJK font support and error handling (V-29)", () => {
  it("throws FontLoadError when CJK font is missing instead of producing textless images", async () => {
    clearFontRegistry();
    setFontResolver(async () => null);
    try {
      const spec = sampleDiagram(["你好", "世界"]);
      await expect(
        renderDiagramPng(spec, "zh-CN")
      ).rejects.toThrow(FontLoadError);
    } finally {
      setFontResolver(null);
    }
  });

  it("renders distinct PNGs with different MD5s for distinct CJK label sets in zh-CN", async () => {
    clearFontRegistry();
    registerFontBuffer("zh-CN", fonts["zh-CN"]);

    const specA = sampleDiagram(["你好世界", "数据库"]);
    const specB = sampleDiagram(["学习课程", "服务器"]);

    const pngA = await renderDiagramPng(specA, "zh-CN");
    const pngB = await renderDiagramPng(specB, "zh-CN");

    const md5A = crypto.createHash("md5").update(pngA).digest("hex");
    const md5B = crypto.createHash("md5").update(pngB).digest("hex");

    expect(pngA.length).toBeGreaterThan(1000);
    expect(pngB.length).toBeGreaterThan(1000);
    expect(md5A).not.toBe(md5B);
  });

  it("renders distinct PNGs with different MD5s for distinct CJK label sets in ko, ja, zh-TW", async () => {
    for (const [loc, labelsA, labelsB] of [
      ["ko", ["한국어테스트", "데이터베이스"], ["시스템아키텍처", "웹서버"]],
      ["ja", ["日本語テスト", "データベース"], ["システム設計", "ウェブサーバー"]],
      ["zh-TW", ["繁體中文測試", "資料庫"], ["系統架構", "伺服器"]],
    ] as const) {
      registerFontBuffer(loc, fonts[loc]);

      const specA = sampleDiagram(labelsA);
      const specB = sampleDiagram(labelsB);

      const pngA = await renderDiagramPng(specA, loc);
      const pngB = await renderDiagramPng(specB, loc);

      const md5A = crypto.createHash("md5").update(pngA).digest("hex");
      const md5B = crypto.createHash("md5").update(pngB).digest("hex");

      expect(pngA.length).toBeGreaterThan(1000);
      expect(pngB.length).toBeGreaterThan(1000);
      expect(md5A).not.toBe(md5B);
    }
  });

  it("renders long CJK labels without layout crash", async () => {
    registerFontBuffer("zh-CN", fonts["zh-CN"]);
    const spec = sampleDiagram([
      "这是测试节点标签用来验证自动折行和文字渲染",
      "另一个包含详细业务逻辑说明的长文本",
    ]);

    const png = await renderDiagramPng(spec, "zh-CN");
    expect(png.length).toBeGreaterThan(1000);
  });
});
