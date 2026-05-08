export type ClaimStatus = "unclaimed" | "pending" | "claimed" | "failed";

export type CertificateItem = {
  id: string;
  title: string;
  course: string;
  issuedAt: string;
  instructor: string;
  type: "online" | "offline";
  credentialId: string;
  /** Ảnh chứng chỉ (placeholder nếu chưa có) */
  imageUrl?: string;
  // OpenCampus
  ocClaimStatus: ClaimStatus;
  ocTransactionHash?: string;
  ocCredentialUrl?: string;
  ocHolderOcId?: string;
};

export type BadgeItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  earnedAt: string | null;
  locked: boolean;
  category: "learning" | "streak" | "milestone" | "social";
  /** Ảnh huy hiệu (placeholder nếu chưa có) */
  imageUrl?: string;
  // OpenCampus
  ocClaimStatus: ClaimStatus;
  ocTransactionHash?: string;
  ocCredentialUrl?: string;
};

export type ModalItem =
  | { kind: "cert"; data: CertificateItem }
  | { kind: "badge"; data: BadgeItem };
