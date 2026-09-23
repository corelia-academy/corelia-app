import React from "npm:react@19.2.0";
import { createAvatar } from "npm:@humation/core@1.0.3";
import satori from "npm:satori@0.33.5";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import { avatarAssets } from "../avatar/assets.ts";
import { EMAIL_BRAND } from "../lib/mail/brand.ts";
import { CourseOG, EventOG, ProfileOG, ProjectOG } from "./cards.tsx";
import type { OgCard } from "./types.ts";

async function readAsset(name: string): Promise<Uint8Array> {
  const url = new URL(`./assets/${name}`, import.meta.url);
  if (typeof Deno !== "undefined" && typeof Deno.readFile === "function") return Deno.readFile(url);
  const { readFile } = await import("node:fs/promises");
  return readFile(url);
}

type RendererAssets = {
  fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: "normal" }>;
  backgroundUrl: string;
  logoUrl: string;
};
let assetsPromise: Promise<RendererAssets> | null = null;
let wasmPromise: Promise<void> | null = null;

async function assetDataUrl(name: string, mime: string): Promise<string> {
  const bytes = await readAsset(name);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
}

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
  }))).then(async fonts => ({
    fonts: [...fonts],
    backgroundUrl: await assetDataUrl("corelia-background-v1.jpg", "image/jpeg"),
    logoUrl: await assetDataUrl("corelia-full-logo-white.png", "image/png"),
  }));
  wasmPromise ??= readAsset("resvg.wasm").then(bytes => initWasm(bytes));
  await wasmPromise;
  return assetsPromise;
}

export async function renderOgImage(card: OgCard, imageDataUrl: string | null): Promise<Uint8Array> {
  const { fonts, backgroundUrl, logoUrl } = await assets();
  let profileAvatar: string | null = null;
  if (card.entity === "profile" && card.avatar) {
    try {
      const { seed, config } = card.avatar;
      const svg = createAvatar(avatarAssets, { seed, ...config, background: config.colors.background }).toString();
      const colors = new Map(Array.from(svg.matchAll(/(--hm-[a-z]+):(#[0-9A-Fa-f]{6})/g), match => [match[1], match[2]]));
      const flattened = svg.replace(/var\((--hm-[a-z]+),\s*(#[0-9A-Fa-f]{6})\)/g,
        (_match, key: string, fallback: string) => colors.get(key) ?? fallback);
      profileAvatar = `data:image/svg+xml;base64,${btoa(flattened)}`;
    } catch { /* Keep the validated Storage image or monogram fallback. */ }
  }
  const props = { card, imageDataUrl: profileAvatar ?? imageDataUrl, backgroundUrl, logoUrl };
  const element = card.entity === "project" ? <ProjectOG {...props} />
    : card.entity === "course" ? <CourseOG {...props} />
    : card.entity === "hackathon" ? <EventOG {...props} /> : <ProfileOG {...props} />;
  const svg = await satori(element, { width: 1200, height: 630, fonts });
  const renderer = new Resvg(svg, { fitTo: { mode: "original" } });
  try { return renderer.render().asPng(); }
  finally { renderer.free(); }
}

export async function renderDefaultOgImage(): Promise<Uint8Array> {
  const { fonts, backgroundUrl, logoUrl } = await assets();
  const svg = await satori(<div style={{ display: "flex", position: "relative", alignItems: "center", justifyContent: "center",
    width: 1200, height: 630, backgroundColor: EMAIL_BRAND.background }}>
    <img src={backgroundUrl} width={1200} height={630} alt=""
      style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover" }} />
    <img src={logoUrl} width={480} height={160} alt="Corelia Academy"
      style={{ position: "relative", width: 480, height: 160, objectFit: "contain" }} />
  </div>, { width: 1200, height: 630, fonts });
  const renderer = new Resvg(svg, { fitTo: { mode: "original" } });
  try { return renderer.render().asPng(); }
  finally { renderer.free(); }
}
