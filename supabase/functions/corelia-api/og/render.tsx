import React from "react";
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { CourseOG, EventOG, ProfileOG, ProjectOG } from "./cards.tsx";
import type { OgCard } from "./types.ts";

async function readAsset(name: string): Promise<Uint8Array> {
  const url = new URL(`./assets/${name}`, import.meta.url);
  if (typeof Deno !== "undefined" && typeof Deno.readFile === "function") return Deno.readFile(url);
  const { readFile } = await import("node:fs/promises");
  return readFile(url);
}

let assetsPromise: Promise<{ fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: "normal" }> }> | null = null;
let wasmPromise: Promise<void> | null = null;

async function assets() {
  const fontFiles = [
    ["tt-norms-pro-normal.ttf", "TT Norms Pro Trial", 400],
    ["tt-norms-pro-medium.ttf", "TT Norms Pro Trial", 500],
    ["akt-medium.ttf", "Akt", 500],
    ["pp-supply-sans-regular.otf", "PP Supply Sans", 400],
    ["latin-400.woff", "Be Vietnam Pro", 400],
    ["vietnamese-400.woff", "Be Vietnam Pro", 400],
    ["latin-700.woff", "Be Vietnam Pro", 700],
    ["vietnamese-700.woff", "Be Vietnam Pro", 700],
  ] as const;
  assetsPromise ??= Promise.all(fontFiles.map(async ([filename, name, weight]) => ({
    name, data: Uint8Array.from(await readAsset(filename)).buffer,
    weight, style: "normal" as const,
  }))).then(fonts => ({ fonts: [...fonts] }));
  wasmPromise ??= readAsset("resvg.wasm").then(bytes => initWasm(bytes));
  await wasmPromise;
  return assetsPromise;
}

export async function renderOgImage(card: OgCard, imageDataUrl: string | null): Promise<Uint8Array> {
  const { fonts } = await assets();
  const props = { card, imageDataUrl };
  const element = card.entity === "project" ? <ProjectOG {...props} />
    : card.entity === "course" ? <CourseOG {...props} />
    : card.entity === "hackathon" ? <EventOG {...props} /> : <ProfileOG {...props} />;
  const svg = await satori(element, { width: 1200, height: 630, fonts });
  const renderer = new Resvg(svg, { fitTo: { mode: "original" } });
  try { return renderer.render().asPng(); }
  finally { renderer.free(); }
}
