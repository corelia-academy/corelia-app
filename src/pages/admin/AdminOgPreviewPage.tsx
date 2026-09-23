import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OgImagePreview } from "@/features/og/OgImagePreview";
import { ogPreviewQueryOptions, probeOgImage, type OgEntity } from "@/features/og/ogPreviewQueries";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function AdminOgPreviewPage() {
  const { t } = useTranslation("admin");
  const [entity, setEntity] = useState<OgEntity>("project");
  const [draft, setDraft] = useState("");
  const [id, setId] = useState("");
  const [dark, setDark] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const metaQuery = useQuery(ogPreviewQueryOptions(entity, id));
  const imageQuery = useQuery({
    queryKey: ["og-preview-image", metaQuery.data?.imageUrl],
    queryFn: () => probeOgImage(metaQuery.data!.imageUrl),
    enabled: Boolean(metaQuery.data?.imageUrl),
    staleTime: 0,
    retry: false,
  });
  usePageMeta({ robots: "noindex, nofollow" });

  const meta = metaQuery.data;
  return <main className="container-app max-w-6xl space-y-6 py-6">
    <div><h1 className="text-2xl font-semibold">{t("ogPreview.title")}</h1>
      <p className="mt-1 text-foreground-muted">{t("ogPreview.description")}</p></div>
    <form className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto]" onSubmit={event => {
      event.preventDefault(); setImageFailed(false); setId(draft.trim());
    }}>
      <label className="space-y-1 text-sm"><span>{t("ogPreview.entity")}</span>
        <select value={entity} onChange={event => { setEntity(event.target.value as OgEntity); setId(""); }}
          className="h-10 w-full rounded-md border border-border bg-background px-3">
          {(["project", "course", "hackathon", "profile"] as const).map(item =>
            <option key={item} value={item}>{t(`ogPreview.entities.${item}`)}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t("ogPreview.identifier")}</span>
        <Input value={draft} onChange={event => setDraft(event.target.value)} maxLength={160}
          placeholder={t("ogPreview.identifierPlaceholder")} /></label>
      <Button type="submit" className="self-end">{t("ogPreview.load")}</Button>
    </form>
    {!id ? <p className="rounded-lg border border-border p-6 text-foreground-muted">{t("ogPreview.enterIdentifier")}</p>
      : metaQuery.isPending ? <p role="status">{t("ogPreview.loading")}</p>
      : metaQuery.isError ? <div role="alert" className="space-y-2"><p>{t("ogPreview.metadataError")}</p>
        <Button type="button" variant="outline" onClick={() => void metaQuery.refetch()}>{t("ogPreview.retry")}</Button></div>
      : !meta ? <p className="rounded-lg border border-border p-6 text-foreground-muted">{t("ogPreview.unavailable")}</p>
      : <div className="space-y-5">
        {imageFailed || imageQuery.data?.status !== 200 && !imageQuery.isPending
          ? <div role="alert" className="space-y-2"><p>{t("ogPreview.imageError")}</p>
            <Button type="button" variant="outline" onClick={() => { setImageFailed(false); void imageQuery.refetch(); }}>
              {t("ogPreview.retry")}</Button></div>
          : <OgImagePreview meta={meta} dark={dark} onToggleDark={() => setDark(value => !value)}
              onError={() => setImageFailed(true)} />}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => { setImageFailed(false); void metaQuery.refetch(); }}>
            {t("ogPreview.refresh")}</Button>
          <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(meta.imageUrl)}>
            {t("ogPreview.copy")}</Button>
          <Button render={<a href={meta.canonicalUrl} target="_blank" rel="noreferrer" />} variant="outline">
            {t("ogPreview.openPage")}</Button>
          <Button render={<a href={meta.imageUrl} target="_blank" rel="noreferrer" />} variant="outline">
            {t("ogPreview.openImage")}</Button>
        </div>
        <dl className="grid gap-2 break-all rounded-lg border border-border p-4 text-sm">
          <div><dt className="font-medium">{t("ogPreview.canonicalUrl")}</dt><dd>{meta.canonicalUrl}</dd></div>
          <div><dt className="font-medium">{t("ogPreview.imageUrl")}</dt><dd>{meta.imageUrl}</dd></div>
          <div><dt className="font-medium">{t("ogPreview.updatedAt")}</dt><dd>{meta.updatedAt}</dd></div>
          <div><dt className="font-medium">{t("ogPreview.revision")}</dt><dd>{meta.revision}</dd></div>
          <div><dt className="font-medium">HTTP</dt><dd>{imageQuery.data?.status ?? "—"} · {imageQuery.data?.contentType ?? "—"}</dd></div>
        </dl>
      </div>}
  </main>;
}
