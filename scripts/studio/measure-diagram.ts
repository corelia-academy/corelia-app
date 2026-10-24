// Times the diagram renderer on saved specs: first call (loads roughjs, resvg.wasm and the font) and
// later calls. Writes the PNGs next to nothing; prints sizes only.
//   deno run -A scripts/studio/measure-diagram.ts <dir with *.json specs>
import { checkDiagram } from "../../supabase/functions/corelia-api/studio/diagram.ts";
import { renderDiagramPng } from "../../supabase/functions/corelia-api/studio/diagram_render.ts";

const dir = Deno.args[0];
if (!dir) {
  console.error("usage: measure-diagram.ts <dir with *.json diagram specs>");
  Deno.exit(1);
}
for await (const entry of Deno.readDir(dir)) {
  if (!entry.name.endsWith(".json")) continue;
  const spec = JSON.parse(await Deno.readTextFile(`${dir}/${entry.name}`));
  const problems = checkDiagram(spec);
  const times: number[] = [];
  let bytes = 0;
  for (let i = 0; i < 4; i++) {
    const start = performance.now();
    bytes = (await renderDiagramPng(spec)).length;
    times.push(Math.round(performance.now() - start));
  }
  console.log(`${entry.name}: check=${problems.length ? problems.join("; ") : "ok"} png=${Math.round(bytes / 1024)}KB ms(first,next...)=${times.join(",")}`);
}
