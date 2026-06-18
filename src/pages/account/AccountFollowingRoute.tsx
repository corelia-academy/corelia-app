import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { useAuth } from "@/stores/authStore";
import { listFollowing, unfollowSubject } from "@/lib/follows";
import type { FollowRow } from "@/types/feed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function AccountFollowingRoute() {
  const { t } = useTranslation("account");
  const { user } = useAuth();
  const [following, setFollowing] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await listFollowing();
      setFollowing(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnfollow = async (subjectType: any, subjectId: string) => {
    try {
      await unfollowSubject({ type: subjectType, id: subjectId });
      setFollowing((current) =>
        current.filter((r) => !(r.subject_type === subjectType && r.subject_id === subjectId))
      );
      toast.success("Đã bỏ theo dõi thành công");
    } catch (e) {
      toast.error("Không thể bỏ theo dõi lúc này");
    }
  };

  const getSubjectLabel = (type: string) => {
    switch (type) {
      case "user": return "Người dùng";
      case "course": return "Khóa học";
      case "hackathon": return "Hackathon";
      case "project": return "Dự án";
      default: return type;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Users className="size-5" />
          Đang theo dõi
        </h1>
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-base p-6 shadow-card">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : following.length === 0 ? (
          <div className="text-center py-8 text-foreground-muted">
            Bạn chưa theo dõi đối tượng nào.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {following.map((row) => (
              <li key={`${row.subject_type}-${row.subject_id}`} className="flex items-center justify-between py-4">
                <div className="min-w-0 pr-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1">
                    {getSubjectLabel(row.subject_type)}
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">
                    ID: {row.subject_id}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleUnfollow(row.subject_type, row.subject_id)}>
                  Bỏ theo dõi
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
