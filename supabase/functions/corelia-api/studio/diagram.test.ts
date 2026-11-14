import { describe, expect, it } from "vitest";
import { checkDiagram, edgeLabel, layout, textWidth, type Diagram } from "./diagram.ts";

/** Row pitch of an unobstructed grid (CELL_H in diagram.ts). */
const CELL_H = 210;

const pair = (labelText: string, labels: [string, string] = ["Trình biên dịch", "Chạy chương trình"]): Diagram => ({
  title: "Luồng",
  nodes: [
    { id: "a", label: labels[0], shape: "box", col: 0, row: 0 },
    { id: "b", label: labels[1], shape: "box", col: 1, row: 0 },
  ],
  edges: [{ from: "a", to: "b", style: "solid", route: "straight", label: labelText, crossed: false }],
});

describe("diagram layout: edge labels never sit on nodes or other labels", () => {
  it("widens the gap for a long Latin edge label", () => {
    const spec = pair("--explain E0308");
    expect(checkDiagram(spec)).toEqual([]);
    const boxes = layout(spec);
    expect(boxes.get("b")!.cx - boxes.get("a")!.cx).toBeGreaterThan(330);
  });

  it("widens the gap for a long CJK edge label and keeps it clear of both boxes", () => {
    const spec = pair("检查类型不匹配的错误信息", ["编译器", "运行程序"]);
    expect(checkDiagram(spec)).toEqual([]);
  });

  it("keeps a translated label (longer than the source) without rejecting the diagram", () => {
    const en = pair("--explain E0308");
    const vi = pair("--explain E0308 để xem giải thích đầy đủ của lỗi kiểu");
    expect(checkDiagram(en)).toEqual([]);
    expect(checkDiagram(vi)).toEqual([]);
    const boxes = layout(vi);
    const label = edgeLabel(vi.edges[0], boxes)!;
    expect(label.w).toBeGreaterThan(textWidth("--explain E0308", 26));
  });

  it("does not add vertical space for an empty grid row", () => {
    const spec: Diagram = {
      title: "Hai luồng",
      nodes: [
        { id: "a", label: "Nguồn", shape: "box", col: 0, row: 0 },
        { id: "b", label: "Đích", shape: "box", col: 0, row: 2 },
      ],
      edges: [{ from: "a", to: "b", style: "solid", route: "straight", label: "", crossed: false }],
    };
    const boxes = layout(spec);
    expect(boxes.get("b")!.cy - boxes.get("a")!.cy).toBe(CELL_H);
    expect(checkDiagram(spec)).toEqual([]);
  });
});

describe("textWidth: CJK glyphs are measured as wide as one em", () => {
  it("keeps Latin width unchanged", () => {
    expect(textWidth("abc", 10)).toBeCloseTo(12);
  });

  it("measures each CJK glyph as one em", () => {
    expect(textWidth("学习", 30)).toBeCloseTo(60);
  });
});
