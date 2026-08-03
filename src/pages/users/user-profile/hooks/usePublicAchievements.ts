import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  fetchPublicProfileCredentialIssuances,
  issuanceToBadgeItem,
} from "@/lib/credentialIssuances";

import type {
  BadgeItem,
  CertificateItem,
  ModalItem,
} from "../../../achievements/types";
import { getPublicProfileById } from "@/lib/profile";

export function usePublicAchievements(profileId: string | undefined) {
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { t } = useTranslation("common");

  const loadAchievements = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      setLoadError(null);
      const [profile, publicIssuances] = await Promise.all([
        getPublicProfileById(profileId),
        fetchPublicProfileCredentialIssuances(profileId),
      ]);

      // This hook is intentionally limited to owner-selected OCCs. Corelia
      // off-chain course certificates are a distinct source and must not be
      // inferred as public merely because a learner completed a course.
      setCertificates([]);
      setBadges(publicIssuances.map((row) => issuanceToBadgeItem(row, profile?.ocid)));
    } catch (error) {
      console.error("[public achievements] load failed", error);
      setLoadError(t("achievements.loadError.body"));
    } finally {
      setLoading(false);
    }
  }, [profileId, t]);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  const openModal = (item: ModalItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  return {
    certificates,
    badges,
    loading,
    loadError,
    reloadAchievements: loadAchievements,
    modalItem,
    modalOpen,
    setModalOpen,
    openModal,
  };
}
