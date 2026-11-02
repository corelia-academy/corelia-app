/**
 * Script tải và đẩy bộ font Google Noto Sans CJK lên Supabase Storage bucket `studio-assets/fonts/`.
 * 
 * GIẤY PHÉP MÃ NGUỒN MỞ:
 * Toàn bộ các font Noto Sans CJK phát hành dưới giấy phép SIL Open Font License, Version 1.1 (OFL 1.1).
 * Bản quyền: Copyright (c) 2014-2021 Adobe Systems Incorporated (http://www.adobe.com/),
 * with Reserved Font Name 'Source'.
 * Copyright (c) 2014-2021 Google Inc.
 * 
 * CÁCH CHẠY SCRIPT:
 * 1. Đảm bảo biến môi trường SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY đã được thiết lập:
 *    export SUPABASE_URL="http://127.0.0.1:54321" # hoặc production URL
 *    export SUPABASE_SERVICE_ROLE_KEY="<service_role_secret>"
 * 2. Chạy với Deno hoặc Node:
 *    deno run --allow-net --allow-read --allow-env scripts/seed-cjk-fonts.ts
 *    hoặc: pnpm tsx scripts/seed-cjk-fonts.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface FontMetadata {
  locale: string;
  family: string;
  fileName: string;
  expectedSha256: string;
  sourceUrl: string;
}

const GOOGLE_FONTS_REVISION = "6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec";

export const CJK_FONTS: FontMetadata[] = [
  {
    locale: "zh-CN",
    family: "Noto Sans SC",
    fileName: "NotoSansSC.ttf",
    expectedSha256: "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da",
    sourceUrl: `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_REVISION}/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf`,
  },
  {
    locale: "zh-TW",
    family: "Noto Sans TC",
    fileName: "NotoSansTC.ttf",
    expectedSha256: "864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f",
    sourceUrl: `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_REVISION}/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf`,
  },
  {
    locale: "ko",
    family: "Noto Sans KR",
    fileName: "NotoSansKR.ttf",
    expectedSha256: "194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252",
    sourceUrl: `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_REVISION}/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf`,
  },
  {
    locale: "ja",
    family: "Noto Sans JP",
    fileName: "NotoSansJP.ttf",
    expectedSha256: "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f",
    sourceUrl: `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_REVISION}/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf`,
  },
];

export function computeSha256(buffer: Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function uploadCjkFonts(
  supabaseClient: ReturnType<typeof createClient>,
  localDir?: string
): Promise<{ fileName: string; size: number; sha256: string; status: "uploaded" | "skipped" }[]> {
  for (const font of CJK_FONTS) {
    if (!/^[0-9a-f]{64}$/.test(font.expectedSha256)) {
      throw new Error(`Thiếu hoặc sai định dạng SHA-256 bắt buộc cho ${font.fileName}`);
    }
  }

  const results: { fileName: string; size: number; sha256: string; status: "uploaded" | "skipped" }[] = [];

  for (const font of CJK_FONTS) {
    let fontBuffer: Uint8Array;

    // 1. Kiểm tra trong thư mục local nếu có
    const localPath = localDir ? join(localDir, font.fileName) : null;
    if (localPath && existsSync(localPath)) {
      fontBuffer = await readFile(localPath);
      console.log(`[seed-fonts] Đã đọc ${font.fileName} từ file cục bộ: ${localPath}`);
    } else {
      console.log(`[seed-fonts] Đang tải ${font.fileName} từ ${font.sourceUrl}...`);
      const res = await fetch(font.sourceUrl);
      if (!res.ok) {
        throw new Error(`Không thể tải ${font.fileName} từ ${font.sourceUrl}: HTTP ${res.status}`);
      }
      fontBuffer = new Uint8Array(await res.arrayBuffer());
    }

    const sha256 = computeSha256(fontBuffer);
    console.log(`[seed-fonts] ${font.fileName} — Size: ${fontBuffer.byteLength} bytes, SHA-256: ${sha256}`);

    if (sha256 !== font.expectedSha256) {
      throw new Error(`Checksum không khớp cho ${font.fileName}: kỳ vọng ${font.expectedSha256}, nhận ${sha256}`);
    }

    // 2. Đẩy lên Supabase Storage bucket studio-assets
    const storagePath = `fonts/${font.fileName}`;
    const { error } = await supabaseClient.storage
      .from("studio-assets")
      .upload(storagePath, fontBuffer, {
        contentType: "font/ttf",
        upsert: true,
      });

    if (error) {
      throw new Error(`Lỗi upload ${font.fileName} lên studio-assets: ${error.message}`);
    }

    results.push({
      fileName: font.fileName,
      size: fontBuffer.byteLength,
      sha256,
      status: "uploaded",
    });
    console.log(`[seed-fonts] Đã upload thành công: studio-assets/${storagePath}`);
  }

  return results;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error("[seed-fonts] Thiếu SUPABASE_SERVICE_ROLE_KEY. Vui lòng đặt biến môi trường.");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceKey);
  console.log(`[seed-fonts] Đang kết nối Supabase tại: ${supabaseUrl}`);
  try {
    const res = await uploadCjkFonts(client);
    console.log("[seed-fonts] Hoàn tất nạp font CJK:", res);
  } catch (err: unknown) {
    console.error("[seed-fonts] Thất bại:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
