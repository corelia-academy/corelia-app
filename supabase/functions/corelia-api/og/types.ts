export const OG_ENTITIES = ["project", "course", "hackathon", "profile"] as const;
export type OgEntity = (typeof OG_ENTITIES)[number];

export type OgCard = {
  entity: OgEntity;
  id: string;
  canonicalId: string;
  title: string;
  description: string | null;
  subtitle: string | null;
  tags: string[];
  imagePath: string | null;
  dateLabel: string | null;
  updatedAt: string;
  canonicalUrl: string;
  revision: string;
};

export type OgPublicMeta = {
  canonicalUrl: string;
  imageUrl: string;
  updatedAt: string;
  revision: string;
  title: string;
  description: string;
  imageAlt: string;
};
