import { useMemo } from "react";
import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";

const WIDTH = 320;
const HEIGHT = 180;
const COLUMNS = 3;
const ROWS = 2;
const generator = rough.generator();

/** FNV-1a hash -> mulberry32 PRNG: the same seed always yields the same sequence. */
function createRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = [number, number];
type ShapeBuilder = (cx: number, cy: number, r: number, o: Options) => Drawable;

const SHAPES: ShapeBuilder[] = [
  (cx, cy, r, o) => generator.circle(cx, cy, r * 2, { ...o, fill: "currentColor", fillStyle: "hachure", hachureGap: 6 }),
  (cx, cy, r, o) => generator.rectangle(cx - r, cy - r * 0.75, r * 2, r * 1.5, { ...o, fill: "currentColor", fillStyle: "hachure", hachureGap: 6 }),
  (cx, cy, r, o) => generator.polygon([[cx, cy - r], [cx + r, cy + r * 0.8], [cx - r, cy + r * 0.8]], { ...o, fill: "currentColor", fillStyle: "hachure", hachureGap: 6 }),
  (cx, cy, r, o) => generator.linearPath([[cx - r, cy + r * 0.5], [cx - r / 3, cy - r * 0.5], [cx + r / 3, cy + r * 0.5], [cx + r, cy - r * 0.5]], o),
  (cx, cy, r, o) => generator.curve([[cx - r, cy], [cx - r / 2, cy - r * 0.8], [cx + r / 2, cy + r * 0.8], [cx + r, cy]] as Point[], o),
  (cx, cy, r, o) => generator.path(`M ${cx - r} ${cy} L ${cx + r} ${cy} M ${cx} ${cy - r} L ${cx} ${cy + r}`, o),
];

function buildShapes(seed: string) {
  const random = createRandom(seed);
  const cellW = WIDTH / COLUMNS;
  const cellH = HEIGHT / ROWS;
  const shapes: { key: number; tone: "primary" | "muted"; paths: ReturnType<typeof generator.toPaths> }[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLUMNS; col += 1) {
      const key = row * COLUMNS + col;
      const cx = col * cellW + cellW / 2 + (random() - 0.5) * cellW * 0.25;
      const cy = row * cellH + cellH / 2 + (random() - 0.5) * cellH * 0.25;
      const r = Math.min(cellW, cellH) * (0.24 + random() * 0.12);
      const build = SHAPES[Math.floor(random() * SHAPES.length)];
      const drawable = build(cx, cy, r, {
        stroke: "currentColor",
        roughness: 1.4,
        bowing: 1,
        strokeWidth: 2,
        seed: Math.floor(random() * 2 ** 31) + 1,
      });
      shapes.push({ key, tone: random() < 0.5 ? "primary" : "muted", paths: generator.toPaths(drawable) });
    }
  }
  return shapes;
}

/** Hand-drawn placeholder cover (roughjs) for courses without a thumbnail; deterministic per seed. */
export function AiCourseCover({ seed, className }: { seed: string; className?: string }) {
  const shapes = useMemo(() => buildShapes(seed), [seed]);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
      className={className}
    >
      {shapes.map(({ key, tone, paths }) => (
        <g key={key} className={tone === "primary" ? "text-primary" : "text-foreground-muted"} strokeLinecap="round" strokeLinejoin="round">
          {paths.map((p, i) => (
            <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill ?? "none"} />
          ))}
        </g>
      ))}
    </svg>
  );
}
