import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listManualBadgeTemplates,
  deleteManualBadgeTemplate,
  type CredentialTemplateRow,
} from "@/lib/credentialTemplates";
import { cn } from "@/lib/utils";
import { ManualMintCreateTemplateDialog } from "./ManualMintCreateTemplateDialog";

interface ManualMintTemplatesTabProps {
  onSelectTemplate: (template: CredentialTemplateRow) => void;
}

export function ManualMintTemplatesTab({ onSelectTemplate }: ManualMintTemplatesTabProps) {
  const { t } = useTranslation("admin");
  const [templates, setTemplates] = useState<CredentialTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const getErrorMessage = useCallback((err: unknown, fallback: string) => {
    const code = err instanceof Error ? err.message : "";
    if (code === "manual_template_delete_forbidden") {
      return t("manualMint.templates.deleteForbidden");
    }
    return code || fallback;
  }, [t]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManualBadgeTemplates();
      setTemplates(data);
    } catch (err) {
      toast.error(getErrorMessage(err, t("manualMint.templates.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage, t]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("manualMint.templates.deleteConfirm", { name }))) return;
    setDeletingId(id);
    try {
      await deleteManualBadgeTemplate(id);
      toast.success(t("manualMint.templates.deleteSuccess"));
      await fetchTemplates();
    } catch (err) {
      toast.error(getErrorMessage(err, t("manualMint.templates.deleteFailed")));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = templates.filter((tpl) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      tpl.name.toLowerCase().includes(q) ||
      (tpl.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search & Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("manualMint.templates.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-foreground-muted">
            {t("manualMint.templates.totalCount", { count: filtered.length })}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" />
            <span>{t("manualMint.templates.createTemplate")}</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle p-8 text-center">
          <ImageIcon className="size-10 text-foreground-muted/40 mb-2" />
          <p className="text-sm font-medium text-foreground">
            {t("manualMint.templates.emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-foreground-muted max-w-sm">
            {t("manualMint.templates.emptySubtitle")}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="mt-4 h-8 gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>{t("manualMint.templates.createTemplate")}</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => {
            const isOcb = tpl.collection_symbol === "ocbadge" || tpl.achievement_type === "Badge";
            return (
              <div
                key={tpl.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-base p-4 shadow-card transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
                      {tpl.image_url ? (
                        <img
                          src={tpl.image_url}
                          alt={tpl.name}
                          className="size-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="size-6 text-foreground-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            isOcb
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-teal-500/10 text-teal-600 dark:text-teal-400",
                          )}
                        >
                          {isOcb
                            ? t("manualMint.templates.ocbBadge")
                            : t("manualMint.templates.ocaCertificate")}
                        </span>
                        {!tpl.is_active && (
                          <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-muted">
                            {t("manualMint.templates.hidden")}
                          </span>
                        )}
                      </div>
                      <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                        {tpl.name}
                      </h3>
                    </div>
                  </div>

                  {tpl.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-foreground-muted">
                      {tpl.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border-subtle/60 pt-3">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => onSelectTemplate(tpl)}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    {t("manualMint.templates.useTemplate")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    disabled={deletingId === tpl.id}
                    onClick={() => handleDelete(tpl.id, tpl.name)}
                  >
                    {deletingId === tpl.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ManualMintCreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void fetchTemplates()}
      />
    </div>
  );
}
