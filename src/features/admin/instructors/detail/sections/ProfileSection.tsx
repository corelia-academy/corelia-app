import type { Dispatch, SetStateAction } from "react";
import type { Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import type { TFunction } from "i18next";

export type InstructorOrigin = NonNullable<Profile["instructor_origin"]>;

export type InstructorEditForm = {
  role: Profile["role"];
  instructor_origin: InstructorOrigin;
  full_name: string;
  email: string;
  phone: string;
  instructor_organization: string;
  instructor_headline: string;
  instructor_bio: string;
  instructor_website: string;
};

export function ProfileSection({
  t,
  editForm,
  setEditForm,
  profileCompletionPercent,
  savingDetails,
  onSave,
}: {
  t: TFunction<"admin">;
  editForm: InstructorEditForm;
  setEditForm: Dispatch<SetStateAction<InstructorEditForm | null>>;
  profileCompletionPercent: number;
  savingDetails: boolean;
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">
            {t("instructorDetailPage.profile.title")}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("instructorDetailPage.profile.description")}
          </p>
        </div>
        <div className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
          <ShieldCheck className="mr-2 size-4 text-primary" aria-hidden />
          {t("instructorDetailPage.profile.completionLabel", {
            percent: profileCompletionPercent,
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium">
            {t("instructorDetailPage.profile.fields.role")}
          </label>
          <select
            value={editForm.role}
            onChange={(e) =>
              setEditForm((prev) =>
                prev ? { ...prev, role: e.target.value as Profile["role"] } : prev,
              )
            }
            className="h-9 rounded-lg border border-border bg-surface-base px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
          >
            <option value="instructor">
              {t("instructorDetailPage.profile.roleOptions.instructor")}
            </option>
            <option value="support_staff">
              {t("instructorDetailPage.profile.roleOptions.supportStaff")}
            </option>
            <option value="admin">Admin</option>
            <option value="student">
              {t("instructorDetailPage.profile.roleOptions.student")}
            </option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">
            {t("instructorDetailPage.profile.fields.origin")}
          </label>
          <select
            value={editForm.instructor_origin}
            onChange={(e) =>
              setEditForm((prev) =>
                prev
                  ? {
                      ...prev,
                      instructor_origin: e.target.value as InstructorOrigin,
                    }
                  : prev,
              )
            }
            className="h-9 rounded-lg border border-border bg-surface-base px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
          >
            <option value="corelia">Corelia</option>
            <option value="external">
              {t("instructorDetailPage.profile.originOptions.external")}
            </option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">
            {t("instructorDetailPage.profile.fields.fullName")}
          </label>
          <Input
            value={editForm.full_name}
            onChange={(e) =>
              setEditForm((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))
            }
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Email</label>
          <Input
            value={editForm.email}
            onChange={(e) =>
              setEditForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))
            }
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">
            {t("instructorDetailPage.profile.fields.phone")}
          </label>
          <Input
            value={editForm.phone}
            onChange={(e) =>
              setEditForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
            }
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">
            {t("instructorDetailPage.profile.fields.organization")}
          </label>
          <Input
            value={editForm.instructor_organization}
            onChange={(e) =>
              setEditForm((prev) =>
                prev ? { ...prev, instructor_organization: e.target.value } : prev,
              )
            }
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Headline</label>
          <Input
            value={editForm.instructor_headline}
            onChange={(e) =>
              setEditForm((prev) =>
                prev ? { ...prev, instructor_headline: e.target.value } : prev,
              )
            }
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Website / LinkedIn</label>
          <Input
            value={editForm.instructor_website}
            onChange={(e) =>
              setEditForm((prev) =>
                prev ? { ...prev, instructor_website: e.target.value } : prev,
              )
            }
          />
        </div>

        <div className="grid gap-2 lg:col-span-2">
          <label className="text-sm font-medium">Bio</label>
          <textarea
            value={editForm.instructor_bio}
            onChange={(e) =>
              setEditForm((prev) =>
                prev ? { ...prev, instructor_bio: e.target.value } : prev,
              )
            }
            rows={5}
            className="min-h-[120px] w-full rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>

        <div className="flex justify-end lg:col-span-2">
          <Button type="button" onClick={onSave} disabled={savingDetails}>
            {savingDetails
              ? t("instructorDetailPage.profile.actions.saving")
              : t("instructorDetailPage.profile.actions.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}

