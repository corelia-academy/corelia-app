const $ = (selector) => document.querySelector(selector);
const elements = {
  list: $("#postList"), search: $("#postSearch"), textarea: $("#contentEditor"),
  title: $("#currentTitle"), path: $("#currentPath"), save: $("#savePost"), status: $("#status"),
  folder: $("#imageFolder"), images: $("#imageList"), upload: $("#imageUpload"),
  dialog: $("#newPostDialog"), newTitle: $("#newTitle"), newSlug: $("#newSlug"), newLocale: $("#newLocale"),
  translationHint: $("#translationHint"), toast: $("#toast"), languageTabs: [...document.querySelectorAll(".language-tab")],
};

const markdown = new EasyMDE({
  element: elements.textarea,
  autofocus: false,
  spellChecker: false,
  status: ["lines", "words", "cursor"],
  placeholder: "Chọn một bài viết ở cột bên trái…",
  toolbar: [
    "bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|",
    "link", "image", "table", "horizontal-rule", "|", "preview", "side-by-side", "fullscreen", "|", "guide",
  ],
});

markdown.codemirror.setOption("readOnly", "nocursor");

let posts = [];
let groups = [];
let currentGroup = null;
let currentPost = null;
let dirty = false;
let loadingEditor = false;
let slugTouched = false;
let pendingTranslationKey = "";

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Không thể hoàn thành thao tác.");
  return data;
}

function notify(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.className = `toast show${error ? " error" : ""}`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => elements.toast.className = "toast", 2600);
}

function setDirty(value) {
  dirty = value;
  elements.save.disabled = !currentPost || !dirty;
  elements.status.textContent = value ? "Có thay đổi chưa lưu" : currentPost ? "Đã lưu" : "Sẵn sàng";
  elements.status.classList.toggle("dirty", value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function groupPosts(items) {
  const map = new Map();
  for (const post of items) {
    if (!map.has(post.translationKey)) map.set(post.translationKey, { key: post.translationKey, vi: null, en: null });
    map.get(post.translationKey)[post.locale] = post;
  }
  return [...map.values()].sort((a, b) => {
    const dateA = a.vi?.date || a.en?.date || "";
    const dateB = b.vi?.date || b.en?.date || "";
    return dateB.localeCompare(dateA) || groupTitle(a).localeCompare(groupTitle(b));
  });
}

function groupTitle(group) {
  return group.vi?.title || group.en?.title || group.key;
}

function filteredGroups() {
  const query = elements.search.value.trim().toLowerCase();
  if (!query) return groups;
  return groups.filter((group) => [group.key, group.vi?.title, group.vi?.slug, group.en?.title, group.en?.slug]
    .filter(Boolean).join(" ").toLowerCase().includes(query));
}

function renderPosts() {
  const items = filteredGroups();
  elements.list.innerHTML = "";
  if (!items.length) elements.list.innerHTML = '<p class="empty">Không tìm thấy bài viết.</p>';
  for (const group of items) {
    const button = document.createElement("button");
    button.className = `post-item${group.key === currentGroup?.key ? " active" : ""}`;
    const badges = `<i class="locale-badge ${group.vi ? "ready" : "missing"}">VI</i><i class="locale-badge ${group.en ? "ready" : "missing"}">EN</i>`;
    button.innerHTML = `<strong>${escapeHtml(groupTitle(group))}</strong><span class="post-meta">${badges}<em>${escapeHtml(group.key)}</em></span>`;
    button.addEventListener("click", () => selectGroup(group));
    elements.list.append(button);
  }
}

async function loadPosts() {
  posts = await request("/api/posts");
  groups = groupPosts(posts);
  if (currentGroup) currentGroup = groups.find((group) => group.key === currentGroup.key) || null;
  renderPosts();
  renderLanguageTabs();
}

function inferFolder(content, slug) {
  const media = content.match(/src:\s*["']\/blog\/([^/"']+)\//);
  return media?.[1] || slug;
}

async function selectGroup(group) {
  if (dirty && !confirm("Bài hiện tại có thay đổi chưa lưu. Bạn vẫn muốn chuyển bài?")) return;
  currentGroup = group;
  const preferredLocale = group.vi ? "vi" : "en";
  await openLocale(preferredLocale, true);
  renderPosts();
}

function renderLanguageTabs() {
  for (const button of elements.languageTabs) {
    const locale = button.dataset.locale;
    const exists = Boolean(currentGroup?.[locale]);
    button.disabled = !currentGroup;
    button.classList.toggle("active", currentPost?.locale === locale);
    button.classList.toggle("missing", Boolean(currentGroup) && !exists);
    button.textContent = exists ? locale.toUpperCase() : `+ ${locale.toUpperCase()}`;
    button.title = exists ? `Chỉnh bản ${locale.toUpperCase()}` : `Tạo bản ${locale.toUpperCase()}`;
  }
}

async function openLocale(locale, force = false) {
  if (!currentGroup) return;
  const post = currentGroup[locale];
  if (!post) return openTranslationDialog(locale);
  if (dirty && !force && !confirm("Ngôn ngữ hiện tại có thay đổi chưa lưu. Bạn vẫn muốn chuyển?")) return;
  const data = await request(`/api/post?path=${encodeURIComponent(post.path)}`);
  currentPost = post;
  loadingEditor = true;
  markdown.value(data.content);
  loadingEditor = false;
  markdown.codemirror.setOption("readOnly", false);
  elements.title.textContent = post.title;
  elements.path.textContent = post.path;
  elements.folder.value = inferFolder(data.content, post.slug);
  setDirty(false);
  renderLanguageTabs();
  await loadImages();
  markdown.codemirror.refresh();
}

async function savePost() {
  if (!currentPost) return;
  try {
    elements.save.disabled = true;
    elements.status.textContent = "Đang lưu…";
    await request("/api/post", { method: "PUT", body: JSON.stringify({ path: currentPost.path, content: markdown.value() }) });
    setDirty(false);
    await loadPosts();
    notify(`Đã lưu bản ${currentPost.locale.toUpperCase()}.`);
  } catch (error) { setDirty(true); notify(error.message, true); }
}

function insertAtCursor(value) {
  if (!currentPost) return notify("Hãy chọn một bài viết trước.", true);
  const cm = markdown.codemirror;
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  const prefix = cursor.ch > 0 && line.trim() ? "\n\n" : "";
  cm.replaceSelection(`${prefix}${value}\n`);
  cm.focus();
}

async function loadImages() {
  const folder = elements.folder.value.trim();
  if (!folder) return;
  try {
    const images = await request(`/api/images?folder=${encodeURIComponent(folder)}`);
    elements.images.innerHTML = "";
    if (!images.length) elements.images.innerHTML = '<p class="empty">Thư mục chưa có ảnh.</p>';
    for (const image of images) {
      const card = document.createElement("div");
      card.className = "image-card";
      card.innerHTML = `<img src="${image.url}" alt=""><button class="delete-image" ${image.used ? "disabled" : ""} title="Xóa ảnh chưa sử dụng">×</button><footer><p>${escapeHtml(image.name)}</p><small>${image.used ? "Đang sử dụng" : "Chưa sử dụng"}</small></footer>`;
      card.querySelector("img").addEventListener("click", () => {
        const alt = prompt("Alt text cho ảnh:", elements.title.textContent) ?? "";
        insertAtCursor(`![${alt}](${image.url})`);
      });
      card.querySelector(".delete-image").addEventListener("click", async () => {
        if (!confirm(`Xóa ${image.name}?`)) return;
        try { await request("/api/image", { method: "DELETE", body: JSON.stringify({ url: image.url }) }); await loadImages(); notify("Đã xóa ảnh."); }
        catch (error) { notify(error.message, true); }
      });
      elements.images.append(card);
    }
  } catch (error) { notify(error.message, true); }
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImages(files) {
  if (!files.length) return;
  if (!elements.folder.value.trim()) return notify("Hãy nhập thư mục ảnh trước.", true);
  try {
    elements.status.textContent = "Đang tải ảnh…";
    const payload = await Promise.all([...files].map(fileDataUrl));
    const uploaded = await request("/api/images", { method: "POST", body: JSON.stringify({ folder: elements.folder.value, files: payload }) });
    await loadImages();
    notify(`Đã thêm ${uploaded.length} ảnh.`);
    elements.status.textContent = dirty ? "Có thay đổi chưa lưu" : "Đã lưu";
  } catch (error) { notify(error.message, true); }
  elements.upload.value = "";
}

function openNewPostDialog() {
  pendingTranslationKey = "";
  slugTouched = false;
  elements.translationHint.classList.add("hidden");
  elements.newLocale.disabled = false;
  elements.dialog.showModal();
  elements.newTitle.focus();
}

function openTranslationDialog(locale) {
  pendingTranslationKey = currentGroup.key;
  slugTouched = false;
  elements.newTitle.value = "";
  elements.newSlug.value = currentGroup.key;
  elements.newLocale.value = locale;
  elements.newLocale.disabled = true;
  elements.translationHint.textContent = `Bản ${locale.toUpperCase()} sẽ được liên kết với “${groupTitle(currentGroup)}”.`;
  elements.translationHint.classList.remove("hidden");
  elements.dialog.showModal();
  elements.newTitle.focus();
}

markdown.codemirror.on("change", () => { if (!loadingEditor && currentPost) setDirty(true); });
elements.save.addEventListener("click", savePost);
elements.search.addEventListener("input", renderPosts);
$("#refreshPosts").addEventListener("click", loadPosts);
$("#loadImages").addEventListener("click", loadImages);
elements.folder.addEventListener("change", loadImages);
elements.upload.addEventListener("change", (event) => uploadImages(event.target.files));
elements.languageTabs.forEach((button) => button.addEventListener("click", () => openLocale(button.dataset.locale)));

$("#newPost").addEventListener("click", openNewPostDialog);
$("#closeDialog").addEventListener("click", () => elements.dialog.close());
elements.newTitle.addEventListener("input", () => {
  if (!slugTouched && !pendingTranslationKey) elements.newSlug.value = elements.newTitle.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
});
elements.newSlug.addEventListener("input", () => { slugTouched = true; });
$("#newPostForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const locale = elements.newLocale.value;
    const created = await request("/api/post", { method: "POST", body: JSON.stringify({
      title: elements.newTitle.value, slug: elements.newSlug.value, locale, translationKey: pendingTranslationKey || elements.newSlug.value,
    }) });
    const selectedKey = pendingTranslationKey || elements.newSlug.value;
    elements.dialog.close();
    event.target.reset();
    elements.newLocale.disabled = false;
    pendingTranslationKey = "";
    await loadPosts();
    currentGroup = groups.find((group) => group.key === selectedKey) || groups.find((group) => group[locale]?.path === created.path);
    await openLocale(locale, true);
    renderPosts();
    notify("Đã tạo bài viết mới.");
  } catch (error) { notify(error.message, true); }
});

window.addEventListener("beforeunload", (event) => { if (dirty) event.preventDefault(); });
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); savePost(); }
});

loadPosts().catch((error) => notify(error.message, true));
