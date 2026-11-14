import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BLOG_CATEGORY_KEYS,
  BLOG_TAG_KEYS,
  blogCategoryLabel,
  blogTagLabel,
  type BlogCategory,
  type BlogLocale,
} from "@corelia/ui/blog";
import { ArrowLeft, Bold, ExternalLink, Heading2, ImagePlus, Italic, Languages, Link2, List, Loader2, Quote, Sparkles, Trash2 } from "lucide-react";
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
  applyBlogTranslation,
  blogTranslationFormFromRecord,
  blogTranslationSource,
  buildBlogPostInput,
  emptyBlogPostForm,
  slugifyBlogTitle,
  type BlogFormError,
  type BlogMediaKind,
  type BlogPostForm,
} from "@/features/blog/blogPost";
import { adminBlogPostQueryOptions, adminBlogPostsQueryOptions, blogKeys } from "@/features/blog/blogQueries";
import { landingUrl } from "@/lib/appUrl";
import { BlogSaveConflictError, deleteBlogPost, getBlogPostAdmin, saveBlogPost } from "@/lib/blog";
import { invokeGenerateDescription } from "@/lib/descriptionGenerator";
import { uploadBlogImage } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type { BlogPostRecord, BlogStatus } from "@/types/blog";

const SELECT_CLASS = "h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm outline-none focus:border-primary";
const LABEL_CLASS = "grid gap-1.5 text-sm font-medium";
const HINT_CLASS = "text-xs font-normal text-foreground-muted";
const PANEL_CLASS = "grid gap-4 rounded-xl border border-border-subtle bg-surface-base p-4";
const PANEL_TITLE_CLASS = "text-xs font-semibold uppercase tracking-wide text-foreground-muted";

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
  return <BlogEditorForm key={saved?.id ?? `new:${sourceId ?? ""}`} saved={saved} initialForm={initialForm} translateFromId={saved ? null : query.data?.id ?? null} />;
}

function BlogEditorForm({
  saved: initialSaved,
  initialForm,
  translateFromId,
}: {
  saved: BlogPostRecord | null;
  initialForm: BlogPostForm;
  /** A new article started as the translation of this one. */
  translateFromId: string | null;
}) {
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

  // Fills the form only: nothing reaches the site until the article is saved.
  const translateMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const source = await getBlogPostAdmin(sourceId);
      if (!source) throw new Error("blog_translation_source_missing");
      const { bundle } = await invokeGenerateDescription({
        action: "translate",
        type: "blog",
        targetField: "description",
        bundleKind: "blog",
        locale: form.locale,
        sourceLocale: source.locale,
        sourceBundle: blogTranslationSource(source),
      });
      if (!bundle?.title) throw new Error("blog_translation_empty");
      return { bundle, sourceLocale: source.locale };
    },
    onSuccess: ({ bundle, sourceLocale }) => {
      setForm((current) => applyBlogTranslation(current, bundle, !slugEdited));
      setTab("write");
      toast.success(t("blog.messages.translated", { language: t(`blog.locales.${sourceLocale}`) }));
    },
    onError: () => toast.error(t("blog.errors.translateFailed")),
  });

  const busy = saveMutation.isPending || deleteMutation.isPending || translateMutation.isPending;

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

  const wordCount = useMemo(() => form.body.trim().split(/\s+/).filter(Boolean).length, [form.body]);

  /** Wraps the selection (or a placeholder) in Markdown and leaves it selected. */
  function format(kind: MarkdownFormat) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const selected = form.body.slice(start, end);
    const [before, after, placeholder] = MARKDOWN_FORMATS[kind];
    const linePrefix = after === "" && start > 0 && form.body[start - 1] !== "\n" ? "\n" : "";
    const text = selected || placeholder;
    const inserted = `${linePrefix}${before}${text}${after}`;
    setForm((current) => ({ ...current, body: current.body.slice(0, start) + inserted + current.body.slice(end) }));
    requestAnimationFrame(() => {
      const from = start + linePrefix.length + before.length;
      textarea.focus();
      textarea.setSelectionRange(from, from + text.length);
    });
  }

  const translateSourceId = translateFromId ?? translation?.id ?? null;
  const translateLabel = t("blog.actions.translateAi", { language: t(`blog.locales.${otherLocale}`) });
  const hasCopy = Boolean(form.title.trim() || form.description.trim() || form.body.trim());
  const translate = () => {
    if (!translateSourceId) return;
    if (hasCopy && !window.confirm(t("blog.confirm.translateOverwrite"))) return;
    translateMutation.mutate(translateSourceId);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle bg-surface-base/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <NavLink to="/admin/blog" className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t("blog.editor.back")}
        </NavLink>
        <span className={published ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300" : "rounded-full bg-surface-raised px-2 py-0.5 text-xs text-foreground-muted"}>
          {t(`blog.status.${saved?.status ?? "draft"}`)}
        </span>
        <span className="mr-auto text-xs text-foreground-muted" aria-live="polite">
          {dirty ? t("blog.editor.unsaved") : saved ? t("blog.editor.saved") : ""}
        </span>
        {publicUrl ? (
          <Button size="small" variant="cta" hierarchy="tertiary" render={<a href={publicUrl} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <ExternalLink className="size-4" aria-hidden />
            {t("blog.actions.view")}
          </Button>
        ) : null}
        <Button type="button" size="small" variant="cta" hierarchy="secondary" disabled={busy} onClick={() => saveMutation.mutate("draft")}>
          {saveMutation.isPending && saveMutation.variables === "draft" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t(published ? "blog.actions.unpublish" : "blog.actions.saveDraft")}
        </Button>
        <Button type="button" size="small" disabled={busy} onClick={() => saveMutation.mutate("published")}>
          {saveMutation.isPending && saveMutation.variables === "published" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t(published ? "blog.actions.update" : "blog.actions.publish")}
        </Button>
      </div>

      <form className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]" onSubmit={(event) => event.preventDefault()}>
        <div className="flex min-w-0 flex-col gap-5">
          <h1 className="sr-only">{saved ? t("blog.editor.editTitle") : t("blog.editor.newTitle")}</h1>
          {translateSourceId && !hasCopy ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="min-w-0 flex-1 basis-64 text-sm text-foreground-muted">{t("blog.editor.translateBanner")}</p>
              <Button type="button" size="small" disabled={busy} onClick={translate}>
                {translateMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                {translateLabel}
              </Button>
            </div>
          ) : null}
          <div>
            <textarea
              rows={1}
              value={form.title}
              onChange={(event) => setTitle(event.target.value.replace(/\n/g, " "))}
              maxLength={300}
              required
              placeholder={t("blog.editor.titlePlaceholder")}
              aria-label={t("blog.fields.title")}
              className="field-sizing-content w-full resize-none bg-transparent font-display text-heading-medium outline-none placeholder:text-foreground-muted/60"
            />
            <p className="mt-1 truncate text-xs text-foreground-muted">
              {landingUrl(blogPublicPath({ locale: form.locale, slug: form.slug || "…", content_type: form.contentType }))}
            </p>
          </div>
          <div>
            <textarea
              className="field-sizing-content min-h-12 w-full resize-none bg-transparent text-base text-foreground-muted outline-none placeholder:text-foreground-muted/60"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={1000}
              placeholder={t("blog.editor.descriptionPlaceholder")}
              aria-label={t("blog.fields.description")}
            />
            <p className={HINT_CLASS}>{t("blog.hints.description")}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
            <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface-raised/50 px-3 py-2">
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
                <div className="flex flex-wrap items-center gap-0.5">
                  {TOOLBAR.map(({ kind, Icon }) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => format(kind)}
                      title={t(`blog.toolbar.${kind}`)}
                      aria-label={t(`blog.toolbar.${kind}`)}
                      className="inline-flex size-8 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                    >
                      <Icon className="size-4" aria-hidden />
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={uploading !== null}
                    onClick={() => bodyImageInputRef.current?.click()}
                    title={t("blog.actions.insertImage")}
                    aria-label={t("blog.actions.insertImage")}
                    className="inline-flex size-8 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
                  >
                    {uploading === "body" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                  </button>
                </div>
              ) : null}
              <span className="ml-auto text-xs text-foreground-muted">{t("blog.editor.words", { total: wordCount })}</span>
              <input ref={bodyImageInputRef} type="file" accept={BLOG_IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void upload(event, "body")} />
            </div>
            {tab === "write" ? (
              <textarea
                ref={bodyRef}
                className="field-sizing-content block min-h-[32rem] w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none"
                value={form.body}
                onChange={(event) => set("body", event.target.value)}
                placeholder={t("blog.editor.bodyPlaceholder")}
                aria-label={t("blog.fields.body")}
                spellCheck
              />
            ) : (
              <div className="min-h-[32rem] px-4 py-3">
                {form.body.trim() ? <Markdown content={form.body} /> : <p className="text-sm text-foreground-muted">{t("blog.editor.previewEmpty")}</p>}
              </div>
            )}
          </div>
          <p className={HINT_CLASS}>{t("blog.hints.body")}</p>
        </div>

        <aside className="grid min-w-0 gap-4 xl:sticky xl:top-20">
          <section className={PANEL_CLASS}>
            <h2 className={PANEL_TITLE_CLASS}>{t("blog.editor.sections.settings")}</h2>
            <Segmented
              label={t("blog.fields.locale")}
              value={form.locale}
              onChange={(value) => set("locale", value)}
              options={[
                { value: "vi", label: t("blog.locales.vi") },
                { value: "en", label: t("blog.locales.en") },
              ]}
            />
            <Segmented
              label={t("blog.fields.contentType")}
              value={form.contentType}
              onChange={(value) => set("contentType", value)}
              options={[
                { value: "blog", label: t("blog.contentTypes.blog") },
                { value: "case-study", label: t("blog.contentTypes.case-study") },
              ]}
            />
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
            {translateSourceId && hasCopy ? (
              <Button type="button" size="small" variant="cta" hierarchy="secondary" disabled={busy} onClick={translate}>
                {translateMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                {translateLabel}
              </Button>
            ) : null}
          </section>

          <section className={PANEL_CLASS}>
            <h2 className={PANEL_TITLE_CLASS}>{t("blog.fields.cover")}</h2>
            <Segmented<BlogMediaKind>
              label={t("blog.fields.cover")}
              hideLabel
              value={form.mediaKind}
              onChange={(value) => set("mediaKind", value)}
              options={[
                { value: "image", label: t("blog.cover.image") },
                { value: "youtube", label: t("blog.cover.youtubeShort") },
                { value: "none", label: t("blog.cover.noneShort") },
              ]}
            />
            {form.mediaKind === "youtube" ? (
              <label className={LABEL_CLASS}>
                {t("blog.fields.youtubeUrl")}
                <Input type="url" value={form.youtubeUrl} onChange={(event) => set("youtubeUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
              </label>
            ) : null}
            {form.mediaKind === "image" ? (
              <>
                <button
                  type="button"
                  disabled={uploading !== null}
                  onClick={() => coverInputRef.current?.click()}
                  className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-subtle bg-surface-raised text-sm text-foreground-muted hover:border-primary"
                >
                  {form.imageSrc.trim() ? (
                    <img
                      src={form.imageSrc.startsWith("/") ? landingUrl(form.imageSrc) : form.imageSrc}
                      alt=""
                      className={`size-full ${form.imageFit === "contain" ? "object-contain" : "object-cover"}`}
                    />
                  ) : null}
                  <span className={form.imageSrc.trim() ? "absolute inset-0 flex items-center justify-center gap-2 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" : "flex items-center gap-2"}>
                    {uploading === "cover" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                    {t("blog.actions.uploadCover")}
                  </span>
                </button>
                <span className={HINT_CLASS}>{t("blog.hints.image")}</span>
                <input ref={coverInputRef} type="file" accept={BLOG_IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => void upload(event, "cover")} />
                <label className={LABEL_CLASS}>
                  {t("blog.fields.imageAlt")}
                  <Input value={form.imageAlt} onChange={(event) => set("imageAlt", event.target.value)} />
                </label>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-foreground-muted hover:text-foreground">{t("blog.editor.sections.coverOptions")}</summary>
                  <div className="mt-3 grid gap-3">
                    <label className={LABEL_CLASS}>
                      {t("blog.fields.imageUrl")}
                      <Input value={form.imageSrc} onChange={(event) => setForm((current) => ({ ...current, imageSrc: event.target.value, imageOgSrc: "" }))} />
                    </label>
                    <label className={LABEL_CLASS}>
                      {t("blog.fields.imageFit")}
                      <select className={SELECT_CLASS} value={form.imageFit} onChange={(event) => set("imageFit", event.target.value as "cover" | "contain")}>
                        <option value="cover">{t("blog.cover.fitCover")}</option>
                        <option value="contain">{t("blog.cover.fitContain")}</option>
                      </select>
                    </label>
                  </div>
                </details>
              </>
            ) : null}
          </section>

          <section className={PANEL_CLASS}>
            <h2 className={PANEL_TITLE_CLASS}>{t("blog.editor.sections.organize")}</h2>
            <label className={LABEL_CLASS}>
              {t("blog.fields.category")}
              <select className={SELECT_CLASS} value={form.category} onChange={(event) => set("category", event.target.value as BlogCategory)}>
                {BLOG_CATEGORY_KEYS.map((category) => (
                  <option key={category} value={category}>{blogCategoryLabel(labelLocale, category)}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="text-sm font-medium">
                {t("blog.fields.tags")} <span className={HINT_CLASS}>{t("blog.hints.tags", { min: BLOG_MIN_TAGS, max: BLOG_MAX_TAGS, selected: form.tags.length })}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
                          ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-primary"
                          : "rounded-full border border-border-subtle px-2.5 py-1 text-xs text-foreground-muted hover:border-primary disabled:opacity-40"
                      }
                    >
                      {blogTagLabel(labelLocale, tag)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <details className={PANEL_CLASS} open={published || undefined}>
            <summary className={`${PANEL_TITLE_CLASS} cursor-pointer`}>{t("blog.editor.sections.advanced")}</summary>
            <div className="mt-4 grid gap-4">
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
                {published ? <span className={HINT_CLASS}>{t("blog.hints.slugPublished")}</span> : null}
              </label>
              <label className={LABEL_CLASS}>
                {t("blog.fields.translationKey")}
                <Input value={form.translationKey} onChange={(event) => set("translationKey", event.target.value)} placeholder={form.slug} maxLength={200} />
                <span className={HINT_CLASS}>{t("blog.hints.translationKey")}</span>
              </label>
            </div>
          </details>

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
        </aside>
      </form>
    </div>
  );
}

type MarkdownFormat = "bold" | "italic" | "heading" | "link" | "list" | "quote";

/** [before, after, placeholder]; an empty `after` marks a line-level format. */
const MARKDOWN_FORMATS: Record<MarkdownFormat, [string, string, string]> = {
  bold: ["**", "**", "text"],
  italic: ["_", "_", "text"],
  heading: ["## ", "", "Heading"],
  link: ["[", "](https://)", "text"],
  list: ["- ", "", "item"],
  quote: ["> ", "", "quote"],
};

const TOOLBAR = [
  { kind: "heading", Icon: Heading2 },
  { kind: "bold", Icon: Bold },
  { kind: "italic", Icon: Italic },
  { kind: "link", Icon: Link2 },
  { kind: "list", Icon: List },
  { kind: "quote", Icon: Quote },
] as const;

function Segmented<T extends string>({
  label,
  hideLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  hideLabel?: boolean;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="grid gap-1.5">
      <span className={hideLabel ? "sr-only" : "text-sm font-medium"}>{label}</span>
      <div className="flex gap-1 rounded-lg bg-surface-raised p-1" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={
              value === option.value
                ? "min-w-0 flex-1 truncate rounded-md bg-surface-base px-2 py-1.5 text-sm font-medium shadow-sm"
                : "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm text-foreground-muted hover:text-foreground"
            }
          >
            {option.label}
          </button>
        ))}
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
