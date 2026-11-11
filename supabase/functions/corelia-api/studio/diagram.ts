// Diagram spec and its deterministic checks, ported from the corelia-studio prototype
// docs/prototypes/diagram-render/diagram.ts (layout, edgeGeometry, crosses, check). The agent
// decides what the diagram shows; code verifies the layout is drawable. Rendering is not ported.

export interface DiagramNode {
  id: string;
  label: string;
  col: number;
  row: number;
  shape: "box" | "ellipse";
}
export interface DiagramEdge {
  from: string;
  to: string;
  style: "solid" | "dashed";
  route: "straight" | "arc_above" | "arc_below";
  label: string;
  crossed: boolean;
}
export interface Diagram {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const CELL_W = 330, CELL_H = 210, CHAR_W = 0.40, MAX_BOX_W = CELL_W - 70;
export const FONT_SIZE = 30;
export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
  shape: DiagramNode["shape"];
  lines: string[];
}

export const LABEL_FONT_SIZE = 26;
/** Free space kept between an edge label and the nearest box border or label. */
const LABEL_GAP = 24;

// CJK glyphs are about one em wide; Latin is measured with the average width CHAR_W.
const isWide = (ch: string) => /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]/.test(ch);
export const textWidth = (s: string, size: number) => [...s].reduce((w, ch) => w + size * (isWide(ch) ? 1 : CHAR_W), 0);

// Wrap only when one line does not fit the widest box.
function wrap(label: string): string[] {
  if (textWidth(label, FONT_SIZE) + 56 <= MAX_BOX_W) return [label];
  const words = label.split(" ");
  let best = [label], diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const d = Math.abs([...a].length - [...b].length);
    if (d < diff) {
      diff = d;
      best = [a, b];
    }
  }
  return best;
}

/**
 * `fillWidth` (optional): when the columns are narrower than this, the extra width is spread evenly over the
 * column gaps, so a diagram with few columns still spans the page it is shown in. Box and font sizes do not change.
 */
export function layout(spec: Diagram, opts: { fillWidth?: number } = {}): Map<string, Box> {
  const sized = new Map<string, Omit<Box, "cx" | "cy">>();
  for (const n of spec.nodes) {
    const lines = wrap(n.label);
    const longest = Math.max(...lines.map((l) => textWidth(l, FONT_SIZE)));
    let w = Math.min(MAX_BOX_W, Math.max(150, longest + 56)), h = lines.length > 1 ? 112 : 84;
    if (n.shape === "ellipse") {
      w += 24;
      h += 12;
    }
    sized.set(n.id, { w, h, shape: n.shape, lines });
  }
  // Only columns and rows that hold a node get a slot, so an empty grid row or column adds no space.
  const cols = [...new Set(spec.nodes.map((n) => n.col))].sort((a, b) => a - b);
  const rows = [...new Set(spec.nodes.map((n) => n.row))].sort((a, b) => a - b);
  const colSlot = new Map(cols.map((c, i) => [c, i]));
  const rowSlot = new Map(rows.map((r, i) => [r, i]));
  const halfW = cols.map((c) => Math.max(...spec.nodes.filter((n) => n.col === c).map((n) => sized.get(n.id)!.w / 2)));
  // gap[i]: distance between the centers of slot i and slot i + 1.
  const colGap = cols.slice(1).map(() => CELL_W);
  const rowGap = rows.slice(1).map(() => CELL_H);
  // A horizontal label must fit between the two box borders; widen the gaps it spans when it does not.
  for (const e of spec.edges) {
    if (!e.label || e.route !== "straight") continue;
    const a = spec.nodes.find((n) => n.id === e.from)!, b = spec.nodes.find((n) => n.id === e.to)!;
    if (a.row !== b.row || a.col === b.col) continue;
    const lo = Math.min(colSlot.get(a.col)!, colSlot.get(b.col)!), hi = Math.max(colSlot.get(a.col)!, colSlot.get(b.col)!);
    const need = textWidth(e.label, LABEL_FONT_SIZE) + LABEL_GAP;
    const free = colGap.slice(lo, hi).reduce((s, g) => s + g, 0) - halfW[lo] - halfW[hi];
    if (free < need) for (let k = lo; k < hi; k++) colGap[k] += (need - free) / (hi - lo);
  }
  if (opts.fillWidth && colGap.length) {
    const spanned = colGap.reduce((s, g) => s + g, 0) + halfW[0] + halfW[halfW.length - 1];
    const extra = opts.fillWidth - spanned;
    if (extra > 0) for (let k = 0; k < colGap.length; k++) colGap[k] += extra / colGap.length;
  }
  const xs = [0];
  colGap.forEach((g) => xs.push(xs[xs.length - 1] + g));
  const ys = [0];
  rowGap.forEach((g) => ys.push(ys[ys.length - 1] + g));
  const boxes = new Map<string, Box>();
  for (const n of spec.nodes) {
    boxes.set(n.id, { ...sized.get(n.id)!, cx: xs[colSlot.get(n.col)!] + CELL_W / 2, cy: ys[rowSlot.get(n.row)!] + CELL_H / 2 });
  }
  return boxes;
}

export interface EdgeLabel {
  text: string;
  x: number;
  y: number;
  anchor: "middle" | "start";
  w: number;
}

/** Blank margin around the drawing on the PNG canvas (shared so the check and the renderer lay out the same width). */
export const PAD = 50;

type Rect = [number, number, number, number];

const overlaps = (a: Rect, b: Rect) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

function labelRect(l: EdgeLabel): Rect {
  const x0 = l.anchor === "middle" ? l.x - l.w / 2 : l.x;
  return [x0, l.y - LABEL_FONT_SIZE / 2, x0 + l.w, l.y + LABEL_FONT_SIZE / 2];
}

/** Half size of the cross drawn on a crossed edge, and the clearance a label keeps from any line or mark. */
const MARK_HALF = 14, LABEL_CLEAR = 4;

/** Points along an edge's drawn curve (quadratic: a straight edge has its midpoint as control point). */
function sampleEdge(g: EdgeGeometry, n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t;
    pts.push([u * u * g.x1 + 2 * u * t * g.cx + t * t * g.x2, u * u * g.y1 + 2 * u * t * g.cy + t * t * g.y2]);
  }
  return pts;
}

/** Does a drawn line (dense samples) run through the label rectangle, including its clearance? */
const lineHitsRect = (pts: [number, number][], r: Rect) =>
  pts.some(([x, y]) => x > r[0] - LABEL_CLEAR && x < r[2] + LABEL_CLEAR && y > r[1] - LABEL_CLEAR && y < r[3] + LABEL_CLEAR);

const markRect = (mid: [number, number], pad = 0): Rect => [mid[0] - MARK_HALF - pad, mid[1] - MARK_HALF - pad, mid[0] + MARK_HALF + pad, mid[1] + MARK_HALF + pad];

/**
 * Where an edge label is drawn, or null when the edge has no label. Shared by the renderer and the check.
 * Text must never sit on a line, a cross mark or a node: the usual spot (above a horizontal edge, beside a vertical
 * one, below an arc) is used when it is clear, otherwise the label moves out along the edge's normal until it is.
 */
export function edgeLabel(e: DiagramEdge, boxes: Map<string, Box>): EdgeLabel | null {
  if (!e.label) return null;
  const g = edgeGeometry(e, boxes);
  const [mx, my] = g.mid;
  const w = textWidth(e.label, LABEL_FONT_SIZE);
  const vertical = e.route === "straight" && Math.abs(g.y2 - g.y1) > Math.abs(g.x2 - g.x1);
  const usual: EdgeLabel = vertical
    ? { text: e.label, x: mx + 14, y: my, anchor: "start", w }
    : { text: e.label, x: mx, y: my + (e.route === "arc_below" ? 28 : -28), anchor: "middle", w };

  const line = sampleEdge(g, 80);
  const mark = e.crossed ? markRect(g.mid, LABEL_CLEAR) : null;
  const clear = (l: EdgeLabel) => {
    const r = labelRect(l);
    if (lineHitsRect(line, r) || (mark && overlaps(r, mark))) return false;
    for (const b of boxes.values()) if (overlaps(r, [b.cx - b.w / 2, b.cy - b.h / 2, b.cx + b.w / 2, b.cy + b.h / 2])) return false;
    return true;
  };
  if (clear(usual)) return usual;

  // Move along the normal of the chord, on either side, far enough that the whole text box clears the line.
  const dx = g.x2 - g.x1, dy = g.y2 - g.y1, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny > 0 || (ny === 0 && nx > 0)) [nx, ny] = [-nx, -ny]; // first try the upper / left side
  const reach = Math.abs(nx) * (w / 2) + Math.abs(ny) * (LABEL_FONT_SIZE / 2) + (e.crossed ? MARK_HALF * 2 : LABEL_CLEAR * 3);
  for (const extra of [0, 16, 32]) {
    for (const side of [1, -1]) {
      const cand: EdgeLabel = { text: e.label, x: mx + side * nx * (reach + extra), y: my + side * ny * (reach + extra), anchor: "middle", w };
      if (clear(cand)) return cand;
    }
  }
  return usual; // nothing clear: checkDiagram reports it instead of drawing text over something
}

// Does segment p→q pass through box b (shrunk slightly so touching corners is allowed)?
function crosses(p: [number, number], q: [number, number], b: Box): boolean {
  const x0 = b.cx - b.w / 2 + 6, x1 = b.cx + b.w / 2 - 6, y0 = b.cy - b.h / 2 + 6, y1 = b.cy + b.h / 2 - 6;
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - x0], [dx, x1 - p[0]], [-dy, p[1] - y0], [dy, y1 - p[1]]]) {
    if (pp === 0) {
      if (qq < 0) return false;
      continue;
    }
    const r = qq / pp;
    if (pp < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

export function border(b: Box, tx: number, ty: number): [number, number] {
  const dx = tx - b.cx, dy = ty - b.cy;
  if (b.shape === "ellipse") {
    const t = 1 / Math.sqrt((dx * dx) / (b.w / 2) ** 2 + (dy * dy) / (b.h / 2) ** 2);
    return [b.cx + dx * t, b.cy + dy * t];
  }
  const t = Math.min(Math.abs(b.w / 2 / (dx || 1e-9)), Math.abs(b.h / 2 / (dy || 1e-9)));
  return [b.cx + dx * t, b.cy + dy * t];
}

export interface EdgeGeometry {
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
  mid: [number, number];
}

// One quadratic curve per edge: a straight edge uses the midpoint as control point.
export function edgeGeometry(e: DiagramEdge, boxes: Map<string, Box>): EdgeGeometry {
  const a = boxes.get(e.from)!, b = boxes.get(e.to)!;
  if (e.route === "straight") {
    const [x1, y1] = border(a, b.cx, b.cy), [x2, y2] = border(b, a.cx, a.cy);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    return { x1, y1, cx, cy, x2, y2, mid: [cx, cy] };
  }
  const s = e.route === "arc_above" ? -1 : 1;
  const x1 = a.cx, y1 = a.cy + (s * a.h) / 2, x2 = b.cx, y2 = b.cy + (s * b.h) / 2;
  const cx = (x1 + x2) / 2, cy = (s < 0 ? Math.min(y1, y2) : Math.max(y1, y2)) + s * 150;
  return { x1, y1, cx, cy, x2, y2, mid: [0.25 * x1 + 0.5 * cx + 0.25 * x2, 0.25 * y1 + 0.5 * cy + 0.25 * y2] };
}

/** Problems that would make the diagram undrawable or misleading; empty when it can be rendered. */
export function checkDiagram(spec: Diagram, opts: { targetWidth?: number } = {}): string[] {
  const problems: string[] = [];
  const ids = new Set<string>(), cells = new Set<string>(), labels = new Set<string>();
  for (const n of spec.nodes) {
    if (ids.has(n.id)) problems.push(`trùng id ${n.id}`);
    ids.add(n.id);
    if (cells.has(`${n.col},${n.row}`)) problems.push(`hai node cùng ô (${n.col},${n.row})`);
    cells.add(`${n.col},${n.row}`);
    if (n.col < 0 || n.col > 3 || n.row < 0 || n.row > 2) problems.push(`node ${n.id} ngoài lưới`);
    if ([...n.label].length > 24) problems.push(`nhãn ${n.id} quá 24 ký tự`);
    if (labels.has(n.label)) problems.push(`hai node cùng nhãn "${n.label}"`);
    labels.add(n.label);
  }
  if (spec.nodes.length === 0) problems.push("không có node");
  if (spec.nodes.length > 8) problems.push("quá 8 node");
  for (const e of spec.edges) if (!ids.has(e.from) || !ids.has(e.to)) problems.push(`edge ${e.from}->${e.to} trỏ node không có`);
  if (problems.length) return problems;
  // Check the layout that will be drawn (same fillWidth as the renderer), not a different one.
  const boxes = layout(spec, opts.targetWidth ? { fillWidth: opts.targetWidth - PAD * 2 } : {});
  // Sample the drawn curve (straight or arc): no edge may pass through another node or run along another edge.
  const sampled = spec.edges.map((e) => sampleEdge(edgeGeometry(e, boxes), 24));
  sampled.forEach((pts, i) => {
    for (let j = i + 1; j < sampled.length; j++) {
      const near = pts.slice(3, -3).filter(([x, y]) => sampled[j].some(([u, v]) => Math.hypot(x - u, y - v) < 18)).length;
      const [a, b] = [spec.edges[i], spec.edges[j]];
      if (near >= 3) problems.push(`edge ${a.from}->${a.to} chồng lên edge ${b.from}->${b.to}; đổi route (above/below) hoặc vị trí node`);
    }
  });
  for (const [i, e] of spec.edges.entries()) {
    const pts = sampled[i];
    for (const [id, other] of boxes) {
      if (id === e.from || id === e.to) continue;
      if (pts.some((p, k) => k > 0 && crosses(pts[k - 1], p, other))) {
        problems.push(`edge ${e.from}->${e.to} (${e.route}) đi xuyên node ${id}; đổi route hoặc vị trí node`);
      }
    }
  }
  // Edge labels must not sit on a node or on another label. Layout widens straight horizontal gaps for
  // labels, so a remaining hit comes from arc labels or from a label stacked on another label.
  const rects = spec.edges.flatMap((e) => {
    const l = edgeLabel(e, boxes);
    return l ? [{ text: l.text, rect: labelRect(l) }] : [];
  });
  for (const r of rects) {
    for (const [id, b] of boxes) {
      if (overlaps(r.rect, [b.cx - b.w / 2, b.cy - b.h / 2, b.cx + b.w / 2, b.cy + b.h / 2])) {
        problems.push(`nhãn "${r.text}" đè lên node ${id}; đổi route hoặc vị trí node`);
      }
    }
  }
  rects.forEach((r, i) => {
    for (const other of rects.slice(i + 1)) {
      if (overlaps(r.rect, other.rect)) problems.push(`nhãn "${r.text}" đè lên nhãn "${other.text}"`);
    }
  });
  // Text must never sit on a line or on a cross mark: check every label against every edge, not only its own.
  const dense = spec.edges.map((e) => sampleEdge(edgeGeometry(e, boxes), 80));
  const marks = spec.edges.flatMap((e) => (e.crossed ? [{ e, rect: markRect(edgeGeometry(e, boxes).mid, 0) }] : []));
  for (const e of spec.edges) {
    const l = edgeLabel(e, boxes);
    if (!l) continue;
    const r = labelRect(l);
    dense.forEach((pts, j) => {
      if (lineHitsRect(pts, r)) problems.push(`nhãn "${l.text}" đè lên đường edge ${spec.edges[j].from}->${spec.edges[j].to}; đổi route hoặc vị trí node`);
    });
    for (const m of marks) {
      if (overlaps(r, m.rect)) problems.push(`nhãn "${l.text}" đè lên dấu gạch chéo của edge ${m.e.from}->${m.e.to}; đổi route hoặc vị trí node`);
    }
  }
  return problems;
}

/**
 * Drawing width (px, before the PNG zoom) for diagrams shown in a lesson. The lesson column is at most
 * min(100%, max(64rem, 80vh * 16 / 9)) wide with 4rem padding on each side (src/features/learning/lessonLayout.tsx), so
 * its text area is at most max(1024, 1.4222 * vh) - 128 px: 1600 matches a viewport about 1215 px tall. An image of
 * this width fills the column on every viewport whose text area is at most 1600 px; narrower columns shrink it.
 */
export const LESSON_DIAGRAM_WIDTH = 1600;

/**
 * Layout smells that are valid but wasteful. Advice for whoever places the nodes, not a reason to reject a diagram
 * (checkDiagram does that), so Studio keeps accepting what it accepted before. Empty when the layout is compact.
 *
 * Smell: a leaf that sits alone on its own row only because it was dropped straight down (or up) from the node that
 * leads to it, while the cell right beside that node is free. The chain should continue in the same row instead:
 * it removes a row and leaves no empty corner.
 */
export function layoutIssues(spec: Diagram): string[] {
  const issues: string[] = [];
  const at = (col: number, row: number) => spec.nodes.find((n) => n.col === col && n.row === row);
  for (const n of spec.nodes) {
    const outs = spec.edges.filter((e) => e.from === n.id), ins = spec.edges.filter((e) => e.to === n.id);
    if (outs.length > 0 || ins.length !== 1) continue; // a leaf with exactly one incoming edge
    if (spec.nodes.filter((m) => m.row === n.row).length !== 1) continue; // alone on its row
    const src = spec.nodes.find((m) => m.id === ins[0].from);
    if (!src || ins[0].route !== "straight" || src.col !== n.col || Math.abs(src.row - n.row) !== 1) continue;
    if (src.col + 1 <= 3 && !at(src.col + 1, src.row)) {
      issues.push(
        `node "${n.label}" đứng một mình ở hàng ${n.row} chỉ vì rơi thẳng xuống từ "${src.label}"; ` +
          `đặt nó cùng hàng, ngay bên phải "${src.label}" (cột ${src.col + 1}, hàng ${src.row}) để bỏ hẳn một hàng`,
      );
    }
  }
  return issues;
}

/**
 * The only wording smell that can be found mechanically: the same edge label three or more times is noise (typically
 * "next"). Advice like layoutIssues, never a reason to reject a diagram. Whether nodes and edges read well (one kind of
 * thing per node, an edge that reads as a sentence "A -label-> B") takes judgement and belongs to the reviewer
 * (course-author skill, platform.md "Nội dung sơ đồ").
 */
export function wordingIssues(spec: Diagram): string[] {
  const issues: string[] = [];
  const counts = new Map<string, number>();
  for (const e of spec.edges) if (e.label) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
  for (const [label, count] of counts) {
    if (count >= 3) issues.push(`nhãn cạnh "${label}" lặp ${count} lần; bỏ nhãn (dãy tuần tự không cần) hoặc đổi thành động từ cụ thể`);
  }
  return issues;
}
