// Checks the diagrams of lesson files before they are rendered: everything checkDiagram rejects (text on a line, node or
// cross mark, edges through nodes, grid limits) at the width lessons draw them, plus the layout and wording advice of layoutIssues and wordingIssues.
// Usage: deno run -A --no-config scripts/studio/diagram-lint.ts <lesson.json> [more lesson.json ...]
// Exit code 1 when any diagram has a problem, so a coordinator can send the lesson back with the printed reasons.
import {
  checkDiagram,
  type Diagram,
  layoutIssues,
  LESSON_DIAGRAM_WIDTH,
  wordingIssues,
} from "../../supabase/functions/corelia-api/studio/diagram.ts";

const files = Deno.args;
if (files.length === 0) {
  console.error("usage: diagram-lint.ts <lesson.json> [more ...]");
  Deno.exit(1);
}

let failed = 0;
for (const file of files) {
  const lesson = JSON.parse(await Deno.readTextFile(file));
  for (const d of lesson.article?.diagrams ?? []) {
    const spec: Diagram = {
      title: "",
      nodes: d.nodes.map((n: Record<string, unknown>) => ({ shape: "box", ...n })),
      edges: d.edges.map((e: Record<string, unknown>) => ({ style: "solid", label: "", crossed: false, ...e })),
    } as Diagram;
    const problems = [
      ...new Set([...checkDiagram(spec), ...checkDiagram(spec, { targetWidth: LESSON_DIAGRAM_WIDTH }), ...layoutIssues(spec), ...wordingIssues(spec)]),
    ];
    if (problems.length) failed++;
    console.log(`${file} · ${d.id}: ${problems.length ? "\n  - " + problems.join("\n  - ") : "ok"}`);
  }
}
Deno.exit(failed ? 1 : 0);
