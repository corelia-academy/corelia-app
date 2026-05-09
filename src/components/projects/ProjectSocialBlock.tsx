import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  addProjectComment,
  getProjectCommentCount,
  listProjectCommentsWithAuthors,
  PROJECT_COMMENT_MAX_LENGTH,
  softDeleteProjectComment,
  toggleProjectHeart,
} from "@/lib/projectSocial";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { ProjectCommentWithAuthor } from "@/types/projects";

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
  hearted: heartedProp = false,
  variant = "default",
  className,
}: ProjectSocialBlockProps) {
  const { t } = useTranslation("common");
  const { user, hasRole: authHasRole } = useAuth();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [hearted, setHearted] = useState(heartedProp);
  const [heartBusy, setHeartBusy] = useState(false);
  const [comments, setComments] = useState<ProjectCommentWithAuthor[]>([]);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [expanded, setExpanded] = useState(variant === "default");
  const [draft, setDraft] = useState("");
  const [postBusy, setPostBusy] = useState(false);

  useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount, projectId]);

  useEffect(() => {
    setHearted(heartedProp);
  }, [heartedProp, projectId]);

  const loadCommentsData = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const [rows, count] = await Promise.all([
        listProjectCommentsWithAuthors(projectId, { limit: 50 }),
        getProjectCommentCount(projectId),
      ]);
      setComments(rows);
      setCommentCount(count);
      setCommentsLoaded(true);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("projects.social.loadCommentsFailed"),
      );
    } finally {
      setCommentsLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (variant === "default") {
      void loadCommentsData();
    }
  }, [variant, loadCommentsData]);

  useEffect(() => {
    if (variant === "compact" && expanded && !commentsLoaded && !commentsLoading) {
      void loadCommentsData();
    }
  }, [variant, expanded, commentsLoaded, commentsLoading, loadCommentsData]);

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
    if (heartBusy) return;

    const was = hearted;
    const countBefore = likeCount;

    setHearted(!was);
    setLikeCount((n) => Math.max(0, n + (was ? -1 : 1)));
    setHeartBusy(true);

    try {
      const nowHearted = await toggleProjectHeart(projectId);
      if (nowHearted !== !was) {
        setHearted(was);
        setLikeCount(countBefore);
      }
    } catch (e) {
      setHearted(was);
      setLikeCount(countBefore);
      toast.error(
        e instanceof Error ? e.message : t("projects.social.heartFailed"),
      );
    } finally {
      setHeartBusy(false);
    }
  }

  async function handlePostComment() {
    if (!user) {
      toast.message(t("projects.social.loginToInteract"));
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) return;
    setPostBusy(true);
    try {
      await addProjectComment(projectId, trimmed);
      setDraft("");
      await loadCommentsData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("projects.social.postFailed");
      if (msg === "LOGIN_REQUIRED") toast.message(t("projects.social.loginToInteract"));
      else if (msg === "COMMENT_EMPTY") toast.message(t("projects.social.commentEmpty"));
      else if (msg === "COMMENT_TOO_LONG") toast.message(t("projects.social.commentTooLong"));
      else toast.error(msg);
    } finally {
      setPostBusy(false);
    }
  }

  async function handleDeleteComment(id: string) {
    try {
      await softDeleteProjectComment(id);
      await loadCommentsData();
      toast.success(t("projects.social.commentRemoved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("projects.social.deleteFailed"));
    }
  }

  const resolvedCommentCount =
    commentCount ?? (commentsLoaded ? comments.length : 0);

  return (
    <div className={cn("border-t border-border-subtle", className)}>
      <div className="flex flex-wrap items-center gap-2 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={heartBusy}
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
          {commentsLoading ? (
            <p className="text-xs text-foreground-muted">{t("projects.social.loadingComments")}</p>
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
              disabled={!user || postBusy}
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
                disabled={!user || postBusy || !draft.trim()}
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
