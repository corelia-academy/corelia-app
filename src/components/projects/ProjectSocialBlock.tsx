import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  addProjectComment,
  PROJECT_COMMENT_MAX_LENGTH,
  softDeleteProjectComment,
  toggleProjectHeart,
} from "@/lib/projectSocial";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { ProjectCommentWithAuthor } from "@/types/projects";
import {
  projectCommentsQueryOptions,
  projectHeartQueryOptions,
  projectSocialKeys,
} from "@/features/projects/projectSocialQueries";

export type ProjectSocialVariant = "default" | "compact";

export type ProjectSocialBlockProps = {
  projectId: string;
  ownerId: string;
  likeCount: number;
  hearted?: boolean;
  variant?: ProjectSocialVariant;
  className?: string;
};

function authorLabel(c: ProjectCommentWithAuthor): string {
  return (
    (c.author_full_name?.trim() || c.author_username?.trim() || "").trim() ||
    "—"
  );
}

export function ProjectSocialBlock({
  projectId,
  ownerId,
  likeCount: initialLikeCount,
  hearted: heartedProp,
  variant = "default",
  className,
}: ProjectSocialBlockProps) {
  const { t } = useTranslation("common");
  const { user, hasRole: authHasRole } = useAuth();
  const queryClient = useQueryClient();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [expanded, setExpanded] = useState(variant === "default");
  const [draft, setDraft] = useState("");
  const commentsEnabled = variant === "default" || expanded;
  const commentsQuery = useQuery(projectCommentsQueryOptions(projectId, commentsEnabled));
  const heartQuery = useQuery(
    projectHeartQueryOptions(user?.id, projectId, heartedProp === undefined),
  );
  const comments = commentsQuery.data?.comments ?? [];
  const hearted = heartQuery.data ?? heartedProp ?? false;
  const commentCount = commentsQuery.data?.count ?? 0;
  const invalidateComments = () =>
    queryClient.invalidateQueries({ queryKey: projectSocialKeys.comments(projectId) });
  const heartMutation = useMutation({
    mutationFn: () => toggleProjectHeart(projectId),
    onSuccess: (next) => {
      if (user?.id) queryClient.setQueryData(projectSocialKeys.heart(user.id, projectId), next);
    },
  });
  const postMutation = useMutation({
    mutationFn: (body: string) => addProjectComment(projectId, body),
    onSuccess: async () => {
      setDraft("");
      await invalidateComments();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: softDeleteProjectComment,
    onSuccess: invalidateComments,
  });

  useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount, projectId]);

  const isStaff = authHasRole(["admin", "support_staff"]);

  const canModerate = Boolean(user && (user.id === ownerId || isStaff));

  const showDeleteFor = useCallback(
    (c: ProjectCommentWithAuthor) => {
      if (!user) return false;
      return user.id === c.author_id || canModerate;
    },
    [user, canModerate],
  );

  async function handleHeart() {
    if (!user) {
      toast.message(t("projects.social.loginToInteract"));
      return;
    }
    if (heartMutation.isPending) return;

    const was = hearted;
    const countBefore = likeCount;

    setLikeCount((n) => Math.max(0, n + (was ? -1 : 1)));

    try {
      const nowHearted = await heartMutation.mutateAsync();
      if (nowHearted !== !was) {
        setLikeCount(countBefore);
      }
    } catch (e) {
      setLikeCount(countBefore);
      toast.error(
        e instanceof Error ? e.message : t("projects.social.heartFailed"),
      );
    } finally { /* mutation owns pending state */ }
  }

  async function handlePostComment() {
    if (!user) {
      toast.message(t("projects.social.loginToInteract"));
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) return;
    try {
      await postMutation.mutateAsync(trimmed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("projects.social.postFailed");
      if (msg === "LOGIN_REQUIRED") toast.message(t("projects.social.loginToInteract"));
      else if (msg === "COMMENT_EMPTY") toast.message(t("projects.social.commentEmpty"));
      else if (msg === "COMMENT_TOO_LONG") toast.message(t("projects.social.commentTooLong"));
      else toast.error(msg);
    } finally { /* mutation owns pending state */ }
  }

  async function handleDeleteComment(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("projects.social.commentRemoved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("projects.social.deleteFailed"));
    }
  }

  const resolvedCommentCount = commentCount;

  return (
    <div className={cn("border-t border-border-subtle", className)}>
      <div className="flex flex-wrap items-center gap-2 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={heartMutation.isPending}
          className={cn("gap-1.5", hearted && "text-rose-600")}
          onClick={() => void handleHeart()}
          aria-pressed={hearted}
          aria-label={hearted ? t("projects.social.unheart") : t("projects.social.heart")}
        >
          <Heart
            className={cn("size-4", hearted && "fill-current")}
            aria-hidden
          />
          <span className="tabular-nums text-sm font-medium">{likeCount}</span>
        </Button>

        {variant === "compact" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground-muted"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <MessageCircle className="size-4" aria-hidden />
            <span className="text-sm">
              {t("projects.social.commentsToggle", { count: resolvedCommentCount })}
            </span>
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-foreground-muted">
            <MessageCircle className="size-4" aria-hidden />
            <span>{t("projects.social.commentsHeading")}</span>
            <span className="tabular-nums">({resolvedCommentCount})</span>
          </div>
        )}
      </div>

      {(variant === "default" || expanded) && (
        <div className="mt-3 space-y-3">
          {commentsQuery.isPending ? (
            <p className="text-xs text-foreground-muted">{t("projects.social.loadingComments")}</p>
          ) : commentsQuery.error ? (
            <p className="text-xs text-destructive">{t("projects.social.loadCommentsFailed")}</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-foreground-muted">{t("projects.social.emptyComments")}</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border border-border-subtle bg-surface-raised/60 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        {authorLabel(c)}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap wrap-break-word text-foreground-muted">
                        {c.body}
                      </div>
                      <div className="mt-1 text-[10px] text-foreground-subtle">
                        {new Date(c.created_at).toLocaleString()}
                      </div>
                    </div>
                    {showDeleteFor(c) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-foreground-muted hover:text-destructive"
                        aria-label={t("projects.social.delete")}
                        onClick={() => void handleDeleteComment(c.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, PROJECT_COMMENT_MAX_LENGTH))}
              rows={variant === "compact" ? 2 : 3}
              disabled={!user || postMutation.isPending}
              placeholder={
                user
                  ? t("projects.social.placeholder")
                  : t("projects.social.loginToInteract")
              }
              className="min-h-16 w-full resize-y rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-foreground-subtle">
                {draft.length}/{PROJECT_COMMENT_MAX_LENGTH}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={!user || postMutation.isPending || !draft.trim()}
                onClick={() => void handlePostComment()}
              >
                {t("projects.social.submit")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
