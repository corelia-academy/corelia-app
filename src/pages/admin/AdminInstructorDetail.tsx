import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { updateProfileAdmin } from "@/lib/profile";
import { useAdminProfiles } from "@/features/admin/users/hooks/useAdminProfiles";
import {
  ProfileSection,
  type InstructorEditForm,
} from "@/features/admin/instructors/detail/sections/ProfileSection";

export default function AdminInstructorDetail() {
  const { t } = useTranslation("admin");
  const { id } = useParams<{ id: string }>();
  const { profiles, setProfiles, loading, error, setError } = useAdminProfiles({
    fallbackErrorMessage: t("instructorDetailPage.errors.loadFailed"),
  });
  const [editForm, setEditForm] = useState<InstructorEditForm | null>(null);
  const instructor = useMemo(
    () => profiles.find((profile) => profile.id === id) ?? null,
    [id, profiles],
  );
  const updateMutation = useMutation({
    mutationFn: ({
      instructorId,
      updates,
    }: {
      instructorId: string;
      updates: Parameters<typeof updateProfileAdmin>[1];
    }) => updateProfileAdmin(instructorId, updates),
    onSuccess: (_, { instructorId, updates }) => {
      setProfiles((current) => current.map((profile) =>
        profile.id === instructorId
          ? { ...profile, ...updates, updated_at: new Date().toISOString() }
          : profile,
      ));
    },
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setEditForm(instructor ? {
        role: instructor.role,
        instructor_origin: instructor.instructor_origin ?? "external",
        full_name: instructor.full_name ?? "",
        email: instructor.email ?? "",
        phone: instructor.phone ?? "",
        instructor_organization: instructor.instructor_organization ?? "",
        instructor_headline: instructor.instructor_headline ?? "",
        instructor_bio: instructor.instructor_bio ?? "",
        instructor_website: instructor.instructor_website ?? "",
      } : null);
    });
    return () => { cancelled = true; };
  }, [instructor]);

  async function handleSaveDetails() {
    if (!instructor || !editForm) return;
    setError(null);
    const updates = {
      role: editForm.role,
      instructor_origin: editForm.instructor_origin,
      full_name: editForm.full_name.trim() || null,
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      instructor_organization: editForm.instructor_organization.trim() || null,
      instructor_headline: editForm.instructor_headline.trim() || null,
      instructor_bio: editForm.instructor_bio.trim() || null,
      instructor_website: editForm.instructor_website.trim() || null,
    };
    try {
      await updateMutation.mutateAsync({ instructorId: instructor.id, updates });
      toast.success(t("instructorDetailPage.toasts.detailsSaved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("instructorDetailPage.errors.saveFailed"));
    }
  }

  if (loading) {
    return <div className="container-app py-8 text-sm text-foreground-muted">{t("instructorDetailPage.loading")}</div>;
  }
  if (!instructor || !editForm) {
    return (
      <div className="container-app py-8">
        <p className="text-sm text-foreground-muted">{t("instructorDetailPage.empty.notFound")}</p>
        <Link to="/admin/instructors" className="mt-3 inline-flex text-sm text-primary hover:underline">
          {t("instructorDetailPage.actions.backToList")}
        </Link>
      </div>
    );
  }

  const completedFields = [
    editForm.full_name,
    editForm.email,
    editForm.phone,
    editForm.instructor_organization,
    editForm.instructor_headline,
    editForm.instructor_bio,
    editForm.instructor_website,
  ].filter((value) => value.trim()).length;

  return (
    <div className="container-app py-6 sm:py-8">
      <Link to="/admin/instructors" className="text-sm text-primary hover:underline">
        {t("instructorDetailPage.actions.backToInstructors")}
      </Link>
      {error ? <div className="my-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      <div className="mt-4">
        <ProfileSection
          t={t}
          editForm={editForm}
          setEditForm={setEditForm}
          profileCompletionPercent={Math.round((completedFields / 7) * 100)}
          savingDetails={updateMutation.isPending}
          onSave={() => void handleSaveDetails()}
        />
      </div>
    </div>
  );
}
