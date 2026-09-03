import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { publicAchievementsQueryOptions } from "@/features/profiles/publicProfileQueries";
import type { CertificateItem, ModalItem } from "../../../achievements/types";

const EMPTY_CERTIFICATES: CertificateItem[] = [];

export function usePublicAchievements(profileId: string | undefined) {
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { t } = useTranslation("common");
  const query = useQuery(publicAchievementsQueryOptions(profileId));

  const openModal = (item: ModalItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  return {
    certificates: EMPTY_CERTIFICATES,
    badges: query.data ?? [],
    loading: Boolean(profileId) && query.isPending,
    loadError: query.error ? t("achievements.loadError.body") : null,
    reloadAchievements: async () => {
      await query.refetch();
    },
    modalItem,
    modalOpen,
    setModalOpen,
    openModal,
  };
}
