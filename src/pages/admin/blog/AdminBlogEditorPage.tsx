import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BLOG_CATEGORY_KEYS,
  BLOG_TAG_KEYS,
  blogCategoryLabel,
  blogTagLabel,
  type BlogCategory,
  type BlogLocale,
} from "@corelia/ui/blog";
import { ArrowLeft, ExternalLink, ImagePlus, Languages, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { QueryErrorState } from "@/components/QueryErrorState";
import { RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { Markdown } from "@/components/markdown/Markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BLOG_IMAGE_MAX_BYTES,
  BLOG_IMAGE_TYPES,
  BLOG_MAX_TAGS,
  BLOG_MIN_TAGS,
  blogPostFormFromRecord,
  blogPublicPath,
  blogTranslationFormFromRecord,
  buildBlogPostInput,
  emptyBlogPostForm,
  slugifyBlogTitle,
  type BlogFormError,
  type BlogMediaKind,
  type BlogPostForm,
} from "@/features/blog/blogPost";
import { adminBlogPostQueryOptions, adminBlogPostsQueryOptions, blogKeys } from "@/features/blog/blogQueries";
import { landingUrl } from "@/lib/appUrl";
import { BlogSaveConflictError, deleteBlogPost, saveBlogPost } from "@/lib/blog";
import { uploadBlogImage } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type { BlogContentType, BlogPostRecord, BlogStatus } from "@/types/blog";

const SELECT_CLASS = "h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm outline-none focus:border-primary";
const TEXTAREA_CLASS = "w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary";
const LABEL_CLASS = "grid gap-1.5 text-sm font-medium";
const HINT_CLASS = "text-xs font-normal text-foreground-muted";

export default function AdminBlogEditorPage() {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // A new article can start as the translation of an existing one (`?from=<id>`).
  const sourceId = id ?? searchParams.get("from") ?? undefined;
  const query = useQuery(adminBlogPostQueryOptions(user?.id, sourceId));

  if (sourceId && query.isPending) return <RouteSkeleton variant="form" />;
  if (sourceId && query.isError) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <QueryErrorState message={t("blog.loadFailed")} retrying={query.isFetching} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  if (id && !query.data) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="p-12 text-center text-sm text-foreground-muted">
            <p>{t("blog.editor.notFound")}</p>
            <Button className="mt-4" render={<NavLink to="/admin/blog" />} nativeButton={false}>{t("blog.editor.back")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const saved = id ? query.data ?? null : null;
  const initialForm = saved
    ? blogPostFormFromRecord(saved)
    : query.data
      ? blogTranslationFormFromRecord(query.data)
      : emptyBlogPostForm();
  // Remount per article so the form state starts from that article's row.
  return <BlogEditorForm key={saved?.id ?? `new:${sourceId ?? ""}`} saved={saved} initialForm={initialForm} />;
}

function BlogEditorForm({ saved: initialSaved, initialForm }: { saved: BlogPostRecord | null; initialForm: BlogPostForm }) {
  const { t, i18n } = useTranslation("admin");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(initialSaved);
  const [form, setForm] = useState(initialForm);
  const [baseline, setBaseline] = useState(initialForm);
  // The slug follows the title until it is edited by hand or the article has been saved.
  const [slugEdited, setSlugEdited] = useState(Boolean(initialSaved));
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState<"cover" | "body" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);
  const labelLocale: BlogLocale = (i18n.resolvedLanguage ?? i18n.language).startsWith("vi") ? "vi" : "en";

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const authorsQuery = useQuery(adminBlogPostsQueryOptions(user?.id));
  const authors = useMemo(
    () => [...new Set((authorsQuery.data ?? []).map((post) => post.author).filter((author): author is string => Boolean(author)))].sort(),
    [authorsQuery.data],
  );

  const set = <K extends keyof BlogPostForm>(key: K, value: BlogPostForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setTitle = (title: string) =>
    setForm((current) => ({ ...current, title, slug: slugEdited ? current.slug : slugifyBlogTitle(title) }));

  const toggleTag = (tag: string) =>
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((value) => value !== tag) : [...current.tags, tag],
    }));

  const saveMutation = useMutation({
    mutationFn: async (status: BlogStatus) => {
      const result = buildBlogPostInput(form, status);
      if ("error" in result) throw new BlogFormInvalid(result.error);
      return { post: await saveBlogPost(saved?.id ?? null, result.input, user?.id), submitted: form };
    },
    onSuccess: ({ post, submitted }, status) => {
      const created = !saved;
      const nextForm = blogPostFormFromRecord(post);
      setSaved(post);
      setBaseline(nextForm);
      // Keep what was typed while the request was in flight.
      setForm((current) => (current === submitted ? nextForm : current));
      setSlugEdited(true);
      queryClient.setQueryData(blogKeys.adminPost(post.id), post);
      void queryClient.invalidateQueries({ queryKey: blogKeys.adminList() });
      toast.success(t(status === "published" ? "blog.messages.published" : "blog.messages.draftSaved"));
      if (created) void navigate(`/admin/blog/${post.id}/edit`, { replace: true });
    },
    onError: (error) => {
      if (error instanceof BlogFormInvalid) toast.error(t(`blog.errors.${error.reason}`, { min: BLOG_MIN_TAGS, max: BLOG_MAX_TAGS }));
      else if (error instanceof BlogSaveConflictError) toast.error(t(error.conflict === "slug_taken" ? "blog.errors.slugTaken" : "blog.errors.translationTaken"));
      else toast.error(t("blog.errors.saveFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBlogPost(saved!.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: blogKeys.adminPost(saved!.id) });
      void queryClient.invalidateQueries({ queryKey: blogKeys.adminList() });
      toast.success(t("blog.messages.deleted"));
      void navigate("/admin/blog", { replace: true });
    },
    onError: () => toast.error(t("blog.errors.deleteFailed")),
  });

  const busy = saveMutation.isPending || deleteMutation.isPending;

  async function upload(event: ChangeEvent<HTMLInputElement>, target: "cover" | "body") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!BLOG_IMAGE_TYPES.includes(file.type)) return void toast.error(t("blog.errors.imageType"));
    if (file.size > BLOG_IMAGE_MAX_BYTES) return void toast.error(t("blog.errors.imageTooLarge"));
    setUploading(target);
    try {
      const { url } = await uploadBlogImage(file);
      if (target === "cover") {
        setForm((current) => ({ ...current, mediaKind: "image", imageSrc: url, imageOgSrc: "" }));
      } else {
        const textarea = bodyRef.current;
        const position = textarea?.selectionStart ?? form.body.length;
        const snippet = `\n\n![](${url})\n\n`;
        setForm((current) => ({ ...current, body: current.body.slice(0, position) + snippet + current.body.slice(position) }));
        requestAnimationFrame(() => {
          // Leave the cursor inside the brackets so the alt text can be typed straight away.
          textarea?.focus();
          textarea?.setSelectionRange(position + 4, position + 4);
        });
      }
    } catch {
      toast.error(t("blog.errors.uploadFailed"));
    } finally {
      setUploading(null);
    }
  }

  const published = saved?.status === "published";
  const publicUrl = saved && published ? landingUrl(blogPublicPath(saved)) : null;
  const otherLocale: BlogLocale = form.locale === "en" ? "vi" : "en";
  const translation = saved
    ? (authorsQuery.data ?? []).find(
        (post) => post.translation_key === saved.translation_key && post.content_type === saved.content_type && post.locale !== saved.locale,
      )
    : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <NavLink to="/admin/blog" className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("blog.editor.back")}
      </NavLink>
      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading-medium font-display">{saved ? t("blog.editor.editTitle") : t("blog.editor.newTitle")}</h1>
          {saved ? (
            <span className={published ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300" : "rounded-full bg-surface-raised px-2 py-0.5 text-xs text-foreground-muted"}>
              {t(`blog.status.${saved.status}`)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {publicUrl ? (
            <Button size="small" variant="cta" hierarchy="secondary" render={<a href={publicUrl} target="_blank" rel="noreferrer" />} nativeButton={false}>
              <ExternalLink className="size-4" aria-hidden />
              {t("blog.actions.view")}
            </Button>
          ) : null}
          {saved ? (
            <Button
              size="small"
              variant="cta"
              hierarchy="secondary"
              render={<NavLink to={translation ? `/admin/blog/${translation.id}/edit` : `/admin/blog/new?from=${saved.id}`} />}
              nativeButton={false}
            >
              <Languages className="size-4" aria-hidden />
              {t(translation ? "blog.actions.openTranslation" : "blog.actions.addTranslation", { language: t(`blog.locales.${otherLocale}`) })}
            </Button>
          ) : null}
        </div>
      </header>

      <form className="mt-6 grid gap-6" onSubmit={(event) => event.preventDefault()}>
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <label className={`${LABEL_CLASS} sm:col-span-2`}>
              {t("blog.fields.title")}
              <Input value={form.title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required />
            </label>
            <label className={LABEL_CLASS}>
              {t("blog.fields.locale")}
              <select className={SELECT_CLASS} value={form.locale} onChange={(event) => set("locale", event.target.value as BlogLocale)}>
                <option value="vi">{t("blog.locales.vi")}</option>
                <option value="en">{t("blog.locales.en")}</option>
              </select>
            </label>
            <label className={LABEL_CLASS}>
              {t("blog.fields.contentType")}
              <select className={SELECT_CLASS} value={form.contentType} onChange={(event) => set("contentType", event.target.value as BlogContentType)}>
                <option value="blog">{t("blog.contentTypes.blog")}</option>
                <option value="case-study">{t("blog.contentTypes.case-study")}</option>
              </select>
            </label>
            <label className={LABEL_CLASS}>
              {t("blog.fields.slug")}
              <Input
                value={form.slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  set("slug", event.target.value);
                }}
                maxLength={200}
                required
              />
              <span className={HINT_CLASS}>
                {published ? t("blog.hints.slugPublished") : blogPublicPath({ locale: form.locale, slug: form.slug || "…", content_type: form.contentType })}
              </span>
            </label>
            <label className={LABEL_CLASS}>
              {t("blog.fields.translationKey")}
              <Input value={form.translationKey} onChange={(event) => set("translationKey", event.target.value)} placeholder={form.slug} maxLength={200} />
              <span className={HINT_CLASS}>{t("blog.hints.translationKey")}</span>
            </label>
            <label className={`${LABEL_CLASS} sm:col-span-2`}>
              {t("blog.fields.description")}
              <textarea className={`${TEXTAREA_CLASS} min-h-20`} value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={1000} />
              <span className={HINT_CLASS}>{t("blog.hints.description")}</span>
            </label>
            <label className={LABEL_CLASS}>
              {t("blog.fields.category")}
              <select className={SELECT_CLASS} value={form.category} onChange={(event) => set("category", event.target.value as BlogCategory)}>
                {BLOG_CATEGORY_KEYS.map((category) => (
                  <option key={category} value={category}>{blogCategoryLabel(labelLocale, category)}</option>
                ))}
              </select>
            </label>
            <label className={LABEL_CLASS}>
              {t("blog.fields.publishedOn")}
              <input type="date" className={SELECT_CLASS} value={form.publishedOn} onChange={(event) => set("publishedOn", event.target.value)} required />
            </label>
            <label className={LABEL_CLASS}>
              {t("blog.fields.author")}
              <Input value={form.author} onChange={(event) => set("author", event.target.value)} list="blog-authors" maxLength={100} />
              <datalist id="blog-authors">
                {authors.map((author) => <option key={author} value={author} />)}
              </datalist>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">
                {t("blog.fields.tags")} <span className={HINT_CLASS}>{t("blog.hints.tags", { min: BLOG_MIN_TAGS, max: BLOG_MAX_TAGS, selected: form.tags.length })}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {BLOG_TAG_KEYS.map((tag) => {
                  const selected = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      disabled={!selected && form.tags.length >= BLOG_MAX_TAGS}
                      onClick={() => toggleTag(tag)}
                      className={
                        selected
                          ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs text-primary"
                          : "rounded-full border border-border-subtle px-3 py-1 text-xs text-foreground-muted hover:border-primary disabled:opacity-40"
                      }
                    >
                      {blogTagLabel(labelLocale, tag)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <label className={LABEL_CLASS}>
              {t("blog.fields.cover")}
              <select className={SELECT_CLASS} value={form.mediaKind} onChange={(event) => set("mediaKind", event.target.value as BlogMediaKind)}>
                <option value="none">{t("blog.cover.none")}</option>
                <option value="image">{t("blog.cover.image")}</option>
                <option value="youtube">{t("blog.cover.youtube")}</option>
              </select>
            </label>
            {form.mediaKind === "youtube" ? (
              <label className={LABEL_CLASS}>
                {t("blog.fields.youtubeUrl")}
                <Input type="url" value={form.youtubeUrl} onChange={(event) => set("youtubeUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
              </label>
            ) : null}
            {form.mediaKind === "image" ? (
              <>
                <div className="grid content-start gap-1.5">
                  <span className="text-sm font-medium">{t("blog.fields.coverImage")}</span>
                  <div>
                    <Button type="button" variant="cta" hierarchy="secondary" disabled={uploading !== null} onClick={() => coverInputRef.current?.click()}>
                      {uploading === "cover" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                      {t("blog.actions.uploadCover")}
                    </Button>
                  </div>
                  <span className={HINT_CLASS}>{t("blog.hints.image")}</span>
                  <input ref={coverInputRef} type="file" accept={BLOG_IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void upload(event, "cover")} />
                </div>
                <label className={LABEL_CLASS}>
                  {t("blog.fields.imageUrl")}
                  <Input value={form.imageSrc} onChange={(event) => setForm((current) => ({ ...current, imageSrc: event.target.value, imageOgSrc: "" }))} />
                </label>
                <label className={LABEL_CLASS}>
                  {t("blog.fields.imageAlt")}
                  <Input value={form.imageAlt} onChange={(event) => set("imageAlt", event.target.value)} />
                </label>
                <label className={LABEL_CLASS}>
                  {t("blog.fields.imageFit")}
                  <select className={SELECT_CLASS} value={form.imageFit} onChange={(event) => set("imageFit", event.target.value as "cover" | "contain")}>
                    <option value="cover">{t("blog.cover.fitCover")}</option>
                    <option value="contain">{t("blog.cover.fitContain")}</option>
                  </select>
                </label>
                {form.imageSrc.trim() ? (
                  <img
                    src={form.imageSrc.startsWith("/") ? landingUrl(form.imageSrc) : form.imageSrc}
                    alt=""
                    className={`aspect-video w-full rounded-lg border border-border-subtle bg-surface-raised sm:col-span-2 ${form.imageFit === "contain" ? "object-contain" : "object-cover"}`}
                  />
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg bg-surface-raised p-1" role="tablist" aria-label={t("blog.fields.body")}>
                {(["write", "preview"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={tab === value ? "rounded-md bg-surface-base px-3 py-1 text-sm font-medium shadow-sm" : "rounded-md px-3 py-1 text-sm text-foreground-muted"}
                  >
                    {t(`blog.editor.${value}`)}
                  </button>
                ))}
              </div>
              {tab === "write" ? (
                <Button type="button" size="small" variant="cta" hierarchy="secondary" disabled={uploading !== null} onClick={() => bodyImageInputRef.current?.click()}>
                  {uploading === "body" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                  {t("blog.actions.insertImage")}
                </Button>
              ) : null}
              <input ref={bodyImageInputRef} type="file" accept={BLOG_IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void upload(event, "body")} />
            </div>
            {tab === "write" ? (
              <>
                <textarea
                  ref={bodyRef}
                  className={`${TEXTAREA_CLASS} mt-4 min-h-[28rem] font-mono leading-6`}
                  value={form.body}
                  onChange={(event) => set("body", event.target.value)}
                  placeholder={t("blog.editor.bodyPlaceholder")}
                  aria-label={t("blog.fields.body")}
                  spellCheck
                />
                <p className={`${HINT_CLASS} mt-2`}>{t("blog.hints.body")}</p>
              </>
            ) : (
              <div className="mt-4 min-h-[28rem] rounded-md border border-border-subtle p-4">
                {form.body.trim() ? <Markdown content={form.body} /> : <p className="text-sm text-foreground-muted">{t("blog.editor.previewEmpty")}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      <div className="sticky bottom-0 z-20 mt-6 rounded-t-xl border border-b-0 border-border-subtle bg-surface-raised/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {saved ? (
            <Button
              type="button"
              variant="destructive"
              hierarchy="tertiary"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("blog.confirm.delete", { title: saved.title }))) deleteMutation.mutate();
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("blog.actions.delete")}
            </Button>
          ) : null}
          <span className="mr-auto text-xs text-foreground-muted">{dirty ? t("blog.editor.unsaved") : saved ? t("blog.editor.saved") : ""}</span>
          <Button type="button" variant="cta" hierarchy="secondary" disabled={busy} onClick={() => saveMutation.mutate("draft")}>
            {saveMutation.isPending && saveMutation.variables === "draft" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t(published ? "blog.actions.unpublish" : "blog.actions.saveDraft")}
          </Button>
          <Button type="button" disabled={busy} onClick={() => saveMutation.mutate("published")}>
            {saveMutation.isPending && saveMutation.variables === "published" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t(published ? "blog.actions.update" : "blog.actions.publish")}
          </Button>
        </div>
      </div>
    </div>
  );
}

class BlogFormInvalid extends Error {
  readonly reason: BlogFormError;

  constructor(reason: BlogFormError) {
    super(`blog_form_${reason}`);
    this.reason = reason;
  }
}
