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

export const textWidth = (s: string, size: number) => [...s].length * size * CHAR_W;

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

export function layout(spec: Diagram): Map<string, Box> {
  const boxes = new Map<string, Box>();
  for (const n of spec.nodes) {
    const lines = wrap(n.label);
    const longest = Math.max(...lines.map((l) => textWidth(l, FONT_SIZE)));
    let w = Math.min(MAX_BOX_W, Math.max(150, longest + 56)), h = lines.length > 1 ? 112 : 84;
    if (n.shape === "ellipse") {
      w += 24;
      h += 12;
    }
    boxes.set(n.id, { cx: n.col * CELL_W + CELL_W / 2, cy: n.row * CELL_H + CELL_H / 2, w, h, shape: n.shape, lines });
  }
  return boxes;
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
export function checkDiagram(spec: Diagram): string[] {
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
  const boxes = layout(spec);
  // Sample the drawn curve (straight or arc): no edge may pass through another node or run along another edge.
  const sampled = spec.edges.map((e) => {
    const g = edgeGeometry(e, boxes);
    const pts: [number, number][] = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, u = 1 - t;
      pts.push([u * u * g.x1 + 2 * u * t * g.cx + t * t * g.x2, u * u * g.y1 + 2 * u * t * g.cy + t * t * g.y2]);
    }
    return pts;
  });
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
  return problems;
}
