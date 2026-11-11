import { describe, expect, it } from "vitest";
import { checkDiagram, edgeLabel, layout, layoutIssues, textWidth, wordingIssues, type Diagram } from "./diagram.ts";

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

describe("diagram layout: text never sits on a line or a cross mark", () => {
  // A diagonal crossed edge: the label used to be centred above the midpoint and the line ran through the text.
  const diagonal = (): Diagram => ({
    title: "Luồng",
    nodes: [
      { id: "a", label: "Website", shape: "box", col: 0, row: 0 },
      { id: "b", label: "Lời website", shape: "box", col: 1, row: 0 },
      { id: "c", label: "Contract nào?", shape: "box", col: 2, row: 1 },
    ],
    edges: [
      { from: "a", to: "b", style: "solid", route: "straight", label: "nói", crossed: false },
      { from: "b", to: "c", style: "dashed", route: "straight", label: "không đủ để biết", crossed: true },
    ],
  });

  const rectOf = (l: { x: number; y: number; w: number; anchor: string }): [number, number, number, number] => {
    const x0 = l.anchor === "middle" ? l.x - l.w / 2 : l.x;
    return [x0, l.y - 13, x0 + l.w, l.y + 13];
  };

  for (const targetWidth of [undefined, 1600]) {
    it(`keeps the label of a diagonal crossed edge off the line and the mark (targetWidth ${targetWidth ?? "none"})`, () => {
      const spec = diagonal();
      expect(checkDiagram(spec, { targetWidth })).toEqual([]);
      const boxes = layout(spec, targetWidth ? { fillWidth: targetWidth - 100 } : {});
      const label = edgeLabel(spec.edges[1], boxes)!;
      const [x0, y0, x1, y1] = rectOf(label);
      const from = boxes.get("b")!, to = boxes.get("c")!;
      // Sample the straight chord: no point may fall inside the label rectangle or the 28 px mark around the midpoint.
      for (let k = 0; k <= 200; k++) {
        const t = k / 200, x = from.cx + (to.cx - from.cx) * t, y = from.cy + (to.cy - from.cy) * t;
        expect(x > x0 && x < x1 && y > y0 && y < y1).toBe(false);
      }
      const mx = (from.cx + to.cx) / 2, my = (from.cy + to.cy) / 2;
      expect(x0 < mx + 14 && mx - 14 < x1 && y0 < my + 14 && my - 14 < y1).toBe(false);
    });
  }

  it("fillWidth spreads the columns to the target width without changing box sizes", () => {
    const spec = diagonal();
    const base = layout(spec), wide = layout(spec, { fillWidth: 1500 });
    const span = (m: Map<string, { cx: number; w: number }>) =>
      Math.max(...[...m.values()].map((b) => b.cx + b.w / 2)) - Math.min(...[...m.values()].map((b) => b.cx - b.w / 2));
    expect(span(wide)).toBeGreaterThan(span(base));
    expect(span(wide)).toBeCloseTo(1500, 0);
    expect(wide.get("a")!.w).toBe(base.get("a")!.w);
  });
});

describe("layoutIssues: keep the chain in one row instead of dropping the last node", () => {
  const nodes = (last: { col: number; row: number }): Diagram["nodes"] => [
    { id: "a", label: "Bước một", shape: "box", col: 0, row: 1 },
    { id: "b", label: "Bước hai", shape: "box", col: 1, row: 1 },
    { id: "c", label: "Bước ba", shape: "box", col: 2, row: 1 },
    { id: "d", label: "Kết quả", shape: "box", ...last },
    { id: "e", label: "Điều kiện", shape: "box", col: 0, row: 0 },
  ];
  const edges: Diagram["edges"] = [
    { from: "a", to: "b", style: "solid", route: "straight", label: "", crossed: false },
    { from: "b", to: "c", style: "solid", route: "straight", label: "", crossed: false },
    { from: "c", to: "d", style: "solid", route: "straight", label: "", crossed: false },
    { from: "e", to: "a", style: "solid", route: "straight", label: "", crossed: false },
  ];

  it("flags a leaf dropped straight down on its own row when the cell beside its source is free", () => {
    const issues = layoutIssues({ title: "", nodes: nodes({ col: 2, row: 2 }), edges });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("Kết quả");
  });

  it("accepts the same chain continued in the same row", () => {
    expect(layoutIssues({ title: "", nodes: nodes({ col: 3, row: 1 }), edges })).toEqual([]);
  });

  it("accepts a fork whose two outcomes sit above and below the node that leads to them", () => {
    const fork: Diagram = {
      title: "",
      nodes: [
        { id: "a", label: "Kiểm tra", shape: "box", col: 0, row: 1 },
        { id: "b", label: "Đúng", shape: "box", col: 1, row: 0 },
        { id: "c", label: "Sai", shape: "box", col: 1, row: 2 },
      ],
      edges: [
        { from: "a", to: "b", style: "solid", route: "straight", label: "", crossed: false },
        { from: "a", to: "c", style: "solid", route: "straight", label: "", crossed: false },
      ],
    };
    expect(layoutIssues(fork)).toEqual([]);
  });
});

describe("wordingIssues: noisy repeated edge labels", () => {
  const edge = (from: string, to: string, label = "") => ({ from, to, style: "solid" as const, route: "straight" as const, label, crossed: false });

  it("flags the same edge label used three times", () => {
    const spec: Diagram = {
      title: "",
      nodes: [1, 2, 3, 4].map((i) => ({ id: `n${i}`, label: `Bước ${i}`, shape: "box" as const, col: i - 1, row: 0 })),
      edges: [edge("n1", "n2", "tiếp theo"), edge("n2", "n3", "tiếp theo"), edge("n3", "n4", "tiếp theo")],
    };
    expect(wordingIssues(spec)).toHaveLength(1);
    expect(wordingIssues({ ...spec, edges: spec.edges.map((e) => ({ ...e, label: "" })) })).toEqual([]);
  });
});
