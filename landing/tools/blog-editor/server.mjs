import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdir, rename, access, unlink } from "node:fs/promises";
import { dirname, extname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOL_DIR, "../..");
const CONTENT_ROOT = resolve(ROOT, "src/content/blog");
const IMAGE_ROOT = resolve(ROOT, "public/blog");
const UI_ROOT = resolve(TOOL_DIR, "public");
const PORT = Number(process.env.BLOG_EDITOR_PORT || 4322);
const HOST = "127.0.0.1";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);

function inside(base, target) {
  const rel = relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(`..${sep}`));
}

function safeResolve(base, input = "") {
  const target = resolve(base, input);
  if (!inside(base, target)) throw new Error("Đường dẫn không hợp lệ.");
  return target;
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function text(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

async function bodyJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 40 * 1024 * 1024) throw new Error("Dữ liệu gửi lên quá lớn (tối đa 40 MB)." );
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function extractMeta(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
  return match?.[1] || "";
}

async function markdownFiles(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) results.push(...await markdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) results.push(full);
  }
  return results;
}

async function listPosts() {
  const files = await markdownFiles(CONTENT_ROOT);
  return Promise.all(files.map(async (file) => {
    const content = await readFile(file, "utf8");
    const path = relative(ROOT, file).split(sep).join("/");
    return {
      path,
      locale: path.includes("/vi/") ? "vi" : "en",
      slug: file.slice(file.lastIndexOf(sep) + 1, -3),
      title: extractMeta(content, "title") || file.slice(file.lastIndexOf(sep) + 1, -3),
      date: extractMeta(content, "date"),
      translationKey: extractMeta(content, "translationKey") || file.slice(file.lastIndexOf(sep) + 1, -3),
    };
  })).then((posts) => posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)));
}

function contentFile(path) {
  if (!/^src\/content\/blog\/(vi|en)\/[a-zA-Z0-9._-]+\.md$/.test(path || "")) {
    throw new Error("Đường dẫn bài viết không hợp lệ.");
  }
  return safeResolve(ROOT, path);
}

function cleanSlug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanFolder(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "").split("/")
    .filter(Boolean).map((part) => part.replace(/[^a-zA-Z0-9._-]+/g, "-")).join("/");
}

function cleanImageName(value) {
  const extension = extname(value).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error(`Định dạng ${extension || "ảnh"} chưa được hỗ trợ.`);
  const stem = value.slice(0, -extension.length).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  return `${stem}${extension}`;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function uniqueImagePath(folderPath, filename) {
  let candidate = resolve(folderPath, filename);
  const extension = extname(filename);
  const stem = filename.slice(0, -extension.length);
  let index = 2;
  while (await exists(candidate)) candidate = resolve(folderPath, `${stem}-${index++}${extension}`);
  return candidate;
}

async function allMarkdown() {
  return Promise.all((await markdownFiles(CONTENT_ROOT)).map((file) => readFile(file, "utf8"))).then((items) => items.join("\n"));
}

async function listImages(folder) {
  const cleaned = cleanFolder(folder);
  if (!cleaned) return [];
  const dir = safeResolve(IMAGE_ROOT, cleaned);
  if (!await exists(dir)) return [];
  const usedInContent = await allMarkdown();
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => {
      const url = `/blog/${cleaned}/${entry.name}`;
      return { name: entry.name, url, used: usedInContent.includes(url) };
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/posts") return json(res, 200, await listPosts());

  if (req.method === "GET" && url.pathname === "/api/post") {
    const path = url.searchParams.get("path");
    return json(res, 200, { path, content: await readFile(contentFile(path), "utf8") });
  }

  if (req.method === "POST" && url.pathname === "/api/post") {
    const data = await bodyJson(req);
    const locale = data.locale === "en" ? "en" : "vi";
    const slug = cleanSlug(data.slug);
    if (!slug) return json(res, 400, { error: "Slug không hợp lệ." });
    const path = `src/content/blog/${locale}/${slug}.md`;
    const file = contentFile(path);
    if (await exists(file)) return json(res, 409, { error: "Bài viết đã tồn tại." });
    const title = String(data.title || slug).replace(/["\r\n]/g, "");
    const translationKey = cleanSlug(data.translationKey) || slug;
    const date = new Date().toISOString().slice(0, 10);
    const starter = locale === "vi" ? "Nội dung bài viết bắt đầu tại đây." : "Start writing the post here.";
    const template = `---\ntitle: "${title}"\ndescription: ""\ndate: ${date}\nlocale: "${locale}"\ntranslationKey: "${translationKey}"\nauthor: "corelia-team"\ncategory: "career-ecosystem-insights"\ntags:\n  - web3\n---\n\n${starter}\n`;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, template, "utf8");
    return json(res, 201, { path, content: template });
  }

  if (req.method === "PUT" && url.pathname === "/api/post") {
    const data = await bodyJson(req);
    const file = contentFile(data.path);
    const temp = `${file}.blog-editor-tmp`;
    await writeFile(temp, String(data.content ?? ""), "utf8");
    await rename(temp, file);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/images") {
    return json(res, 200, await listImages(url.searchParams.get("folder") || ""));
  }

  if (req.method === "POST" && url.pathname === "/api/images") {
    const data = await bodyJson(req);
    const folder = cleanFolder(data.folder);
    if (!folder) return json(res, 400, { error: "Hãy nhập thư mục ảnh." });
    const dir = safeResolve(IMAGE_ROOT, folder);
    await mkdir(dir, { recursive: true });
    const uploaded = [];
    for (const item of data.files || []) {
      const filename = cleanImageName(item.name);
      const file = await uniqueImagePath(dir, filename);
      const encoded = String(item.data || "").replace(/^data:[^;]+;base64,/, "");
      await writeFile(file, Buffer.from(encoded, "base64"));
      uploaded.push({ name: file.slice(file.lastIndexOf(sep) + 1), url: `/blog/${folder}/${file.slice(file.lastIndexOf(sep) + 1)}` });
    }
    return json(res, 201, uploaded);
  }

  if (req.method === "DELETE" && url.pathname === "/api/image") {
    const data = await bodyJson(req);
    const imageUrl = String(data.url || "");
    if (!imageUrl.startsWith("/blog/")) return json(res, 400, { error: "Đường dẫn ảnh không hợp lệ." });
    const referenced = (await allMarkdown()).includes(imageUrl);
    if (referenced) return json(res, 409, { error: "Ảnh đang được sử dụng trong bài viết." });
    await unlink(safeResolve(IMAGE_ROOT, imageUrl.slice("/blog/".length)));
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: "Không tìm thấy API." });
}

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (url.pathname === "/vendor/easymde.min.css") {
      return text(res, 200, await readFile(resolve(ROOT, "node_modules/easymde/dist/easymde.min.css")), "text/css; charset=utf-8");
    }
    if (url.pathname === "/vendor/easymde.min.js") {
      return text(res, 200, await readFile(resolve(ROOT, "node_modules/easymde/dist/easymde.min.js")), "text/javascript; charset=utf-8");
    }
    if (url.pathname.startsWith("/blog/")) {
      const file = safeResolve(resolve(ROOT, "public"), url.pathname.slice(1));
      return text(res, 200, await readFile(file), mime[extname(file).toLowerCase()] || "application/octet-stream");
    }
    const pathname = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = safeResolve(UI_ROOT, pathname);
    return text(res, 200, await readFile(file), mime[extname(file).toLowerCase()] || "application/octet-stream");
  } catch (error) {
    if (error?.code === "ENOENT") return json(res, 404, { error: "Không tìm thấy tệp." });
    console.error(error);
    return json(res, 500, { error: error.message || "Có lỗi xảy ra." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} đang được sử dụng. Blog Editor có thể đã chạy tại http://${HOST}:${PORT}`);
    console.error(`Nếu cần một phiên khác, chạy: BLOG_EDITOR_PORT=4323 pnpm blog:editor`);
    process.exitCode = 1;
    return;
  }
  console.error(`Không thể khởi động Blog Editor: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Corelia Blog Editor đang chạy tại http://${HOST}:${PORT}`);
  console.log("Nhấn Ctrl+C để dừng.");
});
